import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import {
  CreateKnowledgeBaseDto,
  UpdateKnowledgeBaseDto,
  ListKnowledgeBasesQueryDto,
} from './dto/knowledge-base.dto';
import { KnowledgeStatsService } from './knowledge-stats.service';
import { KnowledgePlanLimitsService } from './knowledge-plan-limits.service';
import { DEFAULT_KB_STATS, slugify } from './knowledge.utils';
import { KnowledgeBaseStatus, Prisma } from '@prisma/client';

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private prisma: PrismaService,
    private stats: KnowledgeStatsService,
    private limits: KnowledgePlanLimitsService,
  ) {}

  async assertOwned(id: string, organizationId: string) {
    const kb = await this.prisma.knowledgeBase.findUnique({ where: { id } });
    if (!kb) throw new NotFoundException('Knowledge base not found');
    if (kb.organizationId !== organizationId) {
      throw new ForbiddenException('Knowledge base belongs to another organization');
    }
    return kb;
  }

  private async ensureUniqueSlug(organizationId: string, base: string): Promise<string> {
    let slug = base;
    let n = 0;
    while (
      await this.prisma.knowledgeBase.findUnique({
        where: { organizationId_slug: { organizationId, slug } },
      })
    ) {
      n += 1;
      slug = `${base}-${n}`;
    }
    return slug;
  }

  async findAll(tenant: TenantContext, query: ListKnowledgeBasesQueryDto) {
    const where: Prisma.KnowledgeBaseWhereInput = { organizationId: tenant.organizationId };
    if (query.status) where.status = query.status;

    return this.prisma.knowledgeBase.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { documents: true, sources: true, categories: true } },
      },
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id },
      include: {
        _count: {
          select: { documents: true, sources: true, categories: true, topics: true, tags: true },
        },
      },
    });
    const stats = await this.stats.refresh(id);
    return { ...kb, stats };
  }

  async create(tenant: TenantContext, dto: CreateKnowledgeBaseDto) {
    await this.limits.assertCanCreateKnowledgeBase(tenant.organizationId);

    const baseSlug = dto.slug?.trim() || slugify(dto.name);
    const slug = await this.ensureUniqueSlug(tenant.organizationId, baseSlug);

    return this.prisma.knowledgeBase.create({
      data: {
        organizationId: tenant.organizationId,
        createdBy: tenant.userId,
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim(),
        status: dto.status ?? KnowledgeBaseStatus.DRAFT,
        embeddingProfileId: dto.embeddingProfileId,
        stats: DEFAULT_KB_STATS,
      },
    });
  }

  async update(tenant: TenantContext, id: string, dto: UpdateKnowledgeBaseDto) {
    await this.assertOwned(id, tenant.organizationId);
    return this.prisma.knowledgeBase.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.embeddingProfileId !== undefined
          ? { embeddingProfileId: dto.embeddingProfileId }
          : {}),
      },
    });
  }

  async remove(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    await this.prisma.knowledgeBase.delete({ where: { id } });
    return { deleted: true };
  }
}
