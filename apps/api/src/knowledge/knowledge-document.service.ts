import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeIngestService } from './knowledge-ingest.service';
import { KnowledgeStatsService } from './knowledge-stats.service';
import type { UploadedFilePayload } from './knowledge.utils';
import {
  CreateUrlDocumentDto,
  CreateManualDocumentDto,
  UpdateKnowledgeDocumentDto,
} from './dto/knowledge-document.dto';
import { KnowledgeDocumentStatus, Prisma } from '@prisma/client';

@Injectable()
export class KnowledgeDocumentService {
  constructor(
    private prisma: PrismaService,
    private kb: KnowledgeBaseService,
    private ingest: KnowledgeIngestService,
    private stats: KnowledgeStatsService,
  ) {}

  async assertOwned(id: string, organizationId: string) {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.organizationId !== organizationId) {
      throw new ForbiddenException('Document belongs to another organization');
    }
    return doc;
  }

  async findAll(tenant: TenantContext, knowledgeBaseId: string, status?: string) {
    await this.kb.assertOwned(knowledgeBaseId, tenant.organizationId);
    const where: Prisma.KnowledgeDocumentWhereInput = {
      knowledgeBaseId,
      organizationId: tenant.organizationId,
    };
    if (status && status in KnowledgeDocumentStatus) {
      where.status = status as KnowledgeDocumentStatus;
    }

    return this.prisma.knowledgeDocument.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        tags: { include: { tag: true } },
        category: { select: { id: true, name: true, slug: true } },
        topic: { select: { id: true, name: true, slug: true } },
        _count: { select: { versions: true } },
      },
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    return this.prisma.knowledgeDocument.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { version: 'desc' } },
        tags: { include: { tag: true } },
        category: true,
        topic: true,
        knowledgeSource: { select: { id: true, name: true, type: true, url: true } },
      },
    });
  }

  async createFromUrl(tenant: TenantContext, dto: CreateUrlDocumentDto) {
    return this.ingest.queueUrlIngest(
      tenant,
      dto.knowledgeBaseId,
      dto.url,
      dto.title,
      dto.knowledgeSourceId,
    );
  }

  async createFromManual(tenant: TenantContext, dto: CreateManualDocumentDto) {
    return this.ingest.ingestManualText(
      tenant,
      dto.knowledgeBaseId,
      dto.title,
      dto.text,
    );
  }

  async uploadFile(
    tenant: TenantContext,
    knowledgeBaseId: string,
    file: UploadedFilePayload,
    title?: string,
  ) {
    return this.ingest.queueFileUpload(tenant, knowledgeBaseId, file, title);
  }

  async reprocess(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    return this.ingest.reprocessDocument(tenant, id);
  }

  async reembed(tenant: TenantContext, id: string) {
    const doc = await this.assertOwned(id, tenant.organizationId);
    return this.ingest.reembedDocument(tenant, doc.knowledgeBaseId, id);
  }

  async update(tenant: TenantContext, id: string, dto: UpdateKnowledgeDocumentDto) {
    await this.assertOwned(id, tenant.organizationId);
    return this.prisma.knowledgeDocument.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.topicId !== undefined ? { topicId: dto.topicId } : {}),
      },
    });
  }

  async remove(tenant: TenantContext, id: string) {
    const doc = await this.assertOwned(id, tenant.organizationId);
    await this.prisma.knowledgeDocument.delete({ where: { id } });
    await this.stats.refresh(doc.knowledgeBaseId);
    return { deleted: true };
  }

  async getAiAnalysis(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);

    const doc = await this.prisma.knowledgeDocument.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        topic: { select: { id: true, name: true, slug: true } },
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
        extractedEntities: { orderBy: { confidence: 'desc' }, take: 50 },
        knowledgePipelineRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { stages: { orderBy: { stageOrder: 'asc' } } },
        },
        tagSuggestions: { orderBy: { confidence: 'desc' }, take: 30 },
      },
    });

    if (!doc) throw new NotFoundException('Document not found');

    const meta = (doc.metadata as Record<string, unknown>) ?? {};
    const agentcrm = (meta.agentcrm as Record<string, unknown>) ?? {};
    const latestRun = doc.knowledgePipelineRuns[0] ?? null;

    return {
      documentId: doc.id,
      title: doc.title,
      status: doc.status,
      embeddingStatus: doc.embeddingStatus,
      category: doc.category,
      topic: doc.topic,
      tags: doc.tags.map((dt) => dt.tag),
      summary: (agentcrm.summaryJson as Record<string, unknown>) ?? null,
      classification: (agentcrm.classificationJson as Record<string, unknown>) ?? null,
      entities: doc.extractedEntities,
      tagSuggestions: doc.tagSuggestions,
      qualityScore: (agentcrm.qualityScore as number) ?? null,
      qualityReasons: (agentcrm.qualityReasons as string[]) ?? null,
      pipelineVersion: (meta.pipelineVersion as number) ?? null,
      pipeline: latestRun
        ? {
            runId: latestRun.id,
            status: latestRun.status,
            qualityScore: latestRun.qualityScore,
            qualityBreakdown: latestRun.qualityBreakdown,
            totalInputTokens: latestRun.totalInputTokens,
            totalOutputTokens: latestRun.totalOutputTokens,
            totalCostUsd: latestRun.totalCostUsd,
            createdAt: latestRun.createdAt,
            finishedAt: latestRun.finishedAt,
            stages: latestRun.stages.map((s) => ({
              stage: s.stage,
              status: s.status,
              modelUsed: s.modelUsed,
              error: s.error,
              latencyMs: s.latencyMs,
            })),
          }
        : null,
    };
  }
}
