import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { KnowledgeJobStatus, KnowledgeJobType, Prisma } from '@prisma/client';
import { KnowledgeBaseService } from '../knowledge-base.service';

@Injectable()
export class KnowledgeJobService {
  constructor(
    private prisma: PrismaService,
    private kb: KnowledgeBaseService,
  ) {}

  async createJob(data: {
    organizationId: string;
    knowledgeBaseId: string;
    type: KnowledgeJobType;
    knowledgeSourceId?: string;
    knowledgeDocumentId?: string;
    parentJobId?: string;
    queueName: string;
    bullJobId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.knowledgeJob.create({
      data: {
        organizationId: data.organizationId,
        knowledgeBaseId: data.knowledgeBaseId,
        type: data.type,
        knowledgeSourceId: data.knowledgeSourceId,
        knowledgeDocumentId: data.knowledgeDocumentId,
        parentJobId: data.parentJobId,
        queueName: data.queueName,
        bullJobId: data.bullJobId,
        status: KnowledgeJobStatus.QUEUED,
        metadata: (data.metadata ?? {}) as object,
      },
    });
  }

  async markRunning(jobId: string, progress = 10) {
    await this.prisma.knowledgeJob.update({
      where: { id: jobId },
      data: {
        status: KnowledgeJobStatus.RUNNING,
        progress,
        startedAt: new Date(),
      },
    });
  }

  async markFinished(
    jobId: string,
    status: KnowledgeJobStatus,
    progress = 100,
    error?: string,
  ) {
    await this.prisma.knowledgeJob.update({
      where: { id: jobId },
      data: {
        status,
        progress,
        error: error ?? null,
        finishedAt: new Date(),
      },
    });
  }

  async assertOwned(id: string, organizationId: string) {
    const job = await this.prisma.knowledgeJob.findUnique({
      where: { id },
      include: {
        knowledgeBase: { select: { name: true, slug: true } },
        knowledgeSource: { select: { id: true, name: true, url: true, type: true } },
        knowledgeDocument: { select: { id: true, title: true, sourceUrl: true } },
      },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.organizationId !== organizationId) {
      throw new ForbiddenException('Job belongs to another organization');
    }
    return job;
  }

  async findAll(
    tenant: TenantContext,
    filters: { knowledgeBaseId?: string; status?: KnowledgeJobStatus },
  ) {
    const where: Prisma.KnowledgeJobWhereInput = { organizationId: tenant.organizationId };
    if (filters.knowledgeBaseId) where.knowledgeBaseId = filters.knowledgeBaseId;
    if (filters.status) where.status = filters.status;

    return this.prisma.knowledgeJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        knowledgeBase: { select: { id: true, name: true, slug: true } },
        knowledgeSource: { select: { id: true, name: true, url: true, type: true } },
        knowledgeDocument: { select: { id: true, title: true, format: true, status: true } },
      },
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    return this.assertOwned(id, tenant.organizationId);
  }

  async cancel(tenant: TenantContext, id: string) {
    const job = await this.assertOwned(id, tenant.organizationId);
    if (job.status !== KnowledgeJobStatus.QUEUED && job.status !== KnowledgeJobStatus.RUNNING) {
      return job;
    }
    return this.prisma.knowledgeJob.update({
      where: { id },
      data: { status: KnowledgeJobStatus.CANCELLED, finishedAt: new Date() },
    });
  }
}
