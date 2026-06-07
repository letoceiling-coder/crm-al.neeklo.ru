import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeIngestService } from './knowledge-ingest.service';
import { KnowledgeQueueService } from './jobs/knowledge-queue.service';
import { KnowledgePlanLimitsService } from './knowledge-plan-limits.service';
import { DomainProfileService } from './domain-profile.service';
import {
  CreateKnowledgeSourceDto,
  UpdateKnowledgeSourceDto,
} from './dto/knowledge-source.dto';
import { CrawlStatus, KnowledgeSourceType } from '@prisma/client';
import { extractDomain } from './knowledge.utils';
import { DEFAULT_CRAWL_SETTINGS, DomainCrawlSettings } from './jobs/knowledge-job.types';

@Injectable()
export class KnowledgeSourceService {
  constructor(
    private prisma: PrismaService,
    private kb: KnowledgeBaseService,
    private ingest: KnowledgeIngestService,
    private queue: KnowledgeQueueService,
    private limits: KnowledgePlanLimitsService,
    private domainProfile: DomainProfileService,
  ) {}

  async assertOwned(id: string, organizationId: string) {
    const source = await this.prisma.knowledgeSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException('Knowledge source not found');
    if (source.organizationId !== organizationId) {
      throw new ForbiddenException('Knowledge source belongs to another organization');
    }
    return source;
  }

  async findAll(tenant: TenantContext, knowledgeBaseId: string) {
    await this.kb.assertOwned(knowledgeBaseId, tenant.organizationId);
    return this.prisma.knowledgeSource.findMany({
      where: { knowledgeBaseId, organizationId: tenant.organizationId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { documents: true, jobs: true } } },
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    const source = await this.assertOwned(id, tenant.organizationId);
    return this.prisma.knowledgeSource.findUnique({
      where: { id: source.id },
      include: { _count: { select: { documents: true, jobs: true } } },
    });
  }

  async getHealth(tenant: TenantContext, id: string) {
    const source = await this.assertOwned(id, tenant.organizationId);
    const meta = (source.metadata ?? {}) as { averageChars?: number };
    const domainProfile = source.domain
      ? await this.domainProfile.getProfile(source.domain)
      : null;

    const recentJobs = await this.prisma.knowledgeJob.findMany({
      where: { knowledgeSourceId: id, organizationId: tenant.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      source: {
        id: source.id,
        name: source.name,
        type: source.type,
        crawlStatus: source.crawlStatus,
        lastParsedAt: source.lastParsedAt,
        successRate: source.successRate,
        qualityScore: source.qualityScore,
        lastError: source.lastError,
        parserMode: source.parserMode,
        averageChars: meta.averageChars ?? domainProfile?.averageChars ?? null,
      },
      domainProfile,
      recentJobs,
    };
  }

  async create(tenant: TenantContext, dto: CreateKnowledgeSourceDto) {
    await this.kb.assertOwned(dto.knowledgeBaseId, tenant.organizationId);
    await this.limits.assertCanCreateSource(tenant.organizationId);
    this.validateSourceDto(dto);

    const url = dto.url ?? dto.sitemapUrl;
    const domain = url ? extractDomain(url) : null;
    const crawlSettings = (dto as CreateKnowledgeSourceDto & { crawlSettings?: DomainCrawlSettings })
      .crawlSettings;

    const source = await this.prisma.knowledgeSource.create({
      data: {
        organizationId: tenant.organizationId,
        knowledgeBaseId: dto.knowledgeBaseId,
        type: dto.type,
        name: dto.name?.trim(),
        url: dto.url,
        sitemapUrl: dto.sitemapUrl ?? (dto.type === KnowledgeSourceType.SITEMAP ? dto.url : null),
        domain,
        parserMode: dto.parserMode,
        crawlStatus: CrawlStatus.PENDING,
        metadata: crawlSettings ? ({ crawlSettings } as object) : {},
      },
    });

    let jobResult: { jobId: string; status: 'QUEUED' } | null = null;

    if (dto.type === KnowledgeSourceType.URL && dto.url) {
      jobResult = await this.ingest.queueUrlIngest(
        tenant,
        dto.knowledgeBaseId,
        dto.url,
        dto.name,
        source.id,
        dto.parserMode,
      );
    } else if (dto.type === KnowledgeSourceType.SITEMAP) {
      const sitemapUrl = dto.sitemapUrl ?? dto.url!;
      jobResult = await this.queue.enqueueExpandSitemap({
        organizationId: tenant.organizationId,
        knowledgeBaseId: dto.knowledgeBaseId,
        sourceId: source.id,
        sitemapUrl,
      });
    } else if (dto.type === KnowledgeSourceType.DOMAIN && dto.url) {
      jobResult = await this.queue.enqueueExpandDomain({
        organizationId: tenant.organizationId,
        knowledgeBaseId: dto.knowledgeBaseId,
        sourceId: source.id,
        startUrl: dto.url,
        crawlSettings: crawlSettings ?? DEFAULT_CRAWL_SETTINGS,
      });
    }

    return { source, ...(jobResult ?? {}) };
  }

  async update(tenant: TenantContext, id: string, dto: UpdateKnowledgeSourceDto) {
    await this.assertOwned(id, tenant.organizationId);
    return this.prisma.knowledgeSource.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.parserMode !== undefined ? { parserMode: dto.parserMode } : {}),
      },
    });
  }

  async remove(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    await this.prisma.knowledgeSource.delete({ where: { id } });
    return { deleted: true };
  }

  async triggerCrawl(tenant: TenantContext, id: string) {
    const source = await this.assertOwned(id, tenant.organizationId);

    await this.prisma.knowledgeSource.update({
      where: { id },
      data: { crawlStatus: CrawlStatus.ACTIVE },
    });

    if (source.type === KnowledgeSourceType.URL && source.url) {
      return this.ingest.queueUrlIngest(
        tenant,
        source.knowledgeBaseId,
        source.url,
        source.name ?? undefined,
        source.id,
        source.parserMode,
      );
    }
    if (source.type === KnowledgeSourceType.SITEMAP) {
      const sitemapUrl = source.sitemapUrl ?? source.url;
      if (!sitemapUrl) throw new BadRequestException('No sitemap URL');
      return this.queue.enqueueExpandSitemap({
        organizationId: tenant.organizationId,
        knowledgeBaseId: source.knowledgeBaseId,
        sourceId: source.id,
        sitemapUrl,
      });
    }
    if (source.type === KnowledgeSourceType.DOMAIN && source.url) {
      const settings = (source.metadata as { crawlSettings?: DomainCrawlSettings })?.crawlSettings;
      return this.queue.enqueueExpandDomain({
        organizationId: tenant.organizationId,
        knowledgeBaseId: source.knowledgeBaseId,
        sourceId: source.id,
        startUrl: source.url,
        crawlSettings: settings ?? DEFAULT_CRAWL_SETTINGS,
      });
    }

    throw new BadRequestException('Unsupported source type for crawl');
  }

  private validateSourceDto(dto: CreateKnowledgeSourceDto) {
    if (dto.type === KnowledgeSourceType.URL && !dto.url) {
      throw new BadRequestException('URL required for URL source type');
    }
    if (dto.type === KnowledgeSourceType.SITEMAP && !dto.sitemapUrl && !dto.url) {
      throw new BadRequestException('Sitemap URL required for SITEMAP source type');
    }
    if (dto.type === KnowledgeSourceType.DOMAIN && !dto.url) {
      throw new BadRequestException('Domain URL required for DOMAIN source type');
    }
  }
}
