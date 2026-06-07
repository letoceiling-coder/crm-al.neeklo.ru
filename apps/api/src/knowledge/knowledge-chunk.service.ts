import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { KnowledgeBaseService } from './knowledge-base.service';

@Injectable()
export class KnowledgeChunkService {
  constructor(
    private prisma: PrismaService,
    private kb: KnowledgeBaseService,
  ) {}

  async findAll(
    tenant: TenantContext,
    filters: { knowledgeBaseId: string; documentId?: string },
  ) {
    await this.kb.assertOwned(filters.knowledgeBaseId, tenant.organizationId);

    return this.prisma.knowledgeChunk.findMany({
      where: {
        organizationId: tenant.organizationId,
        knowledgeBaseId: filters.knowledgeBaseId,
        ...(filters.documentId ? { documentId: filters.documentId } : {}),
      },
      orderBy: [{ documentId: 'asc' }, { chunkIndex: 'asc' }],
      take: 500,
      include: {
        document: { select: { id: true, title: true, embeddingStatus: true } },
        embeddings: { select: { id: true, profileId: true, dimensions: true, createdAt: true } },
      },
    });
  }

  async getSummary(tenant: TenantContext, knowledgeBaseId: string) {
    await this.kb.assertOwned(knowledgeBaseId, tenant.organizationId);

    const [chunkCount, embeddedCount, docs] = await Promise.all([
      this.prisma.knowledgeChunk.count({
        where: { knowledgeBaseId, organizationId: tenant.organizationId },
      }),
      this.prisma.knowledgeDocument.count({
        where: {
          knowledgeBaseId,
          organizationId: tenant.organizationId,
          embeddingStatus: 'INDEXED',
        },
      }),
      this.prisma.knowledgeDocument.findMany({
        where: { knowledgeBaseId, organizationId: tenant.organizationId, status: 'READY' },
        select: {
          id: true,
          title: true,
          chunkCount: true,
          embeddingStatus: true,
          parserChars: true,
          metadata: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      }),
    ]);

    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
      include: { embeddingProfile: { select: { id: true, name: true, model: true, provider: true, dimensions: true } } },
    });

    return {
      chunkCount,
      indexedDocuments: embeddedCount,
      totalReadyDocuments: docs.length,
      embeddingProfile: kb?.embeddingProfile ?? null,
      documents: docs.map((d) => ({
        id: d.id,
        title: d.title,
        chunkCount: d.chunkCount,
        charCount: d.parserChars,
        embeddingStatus: d.embeddingStatus,
        embeddingModel: (d.metadata as { embeddingModel?: string })?.embeddingModel ?? kb?.embeddingProfile?.model,
      })),
    };
  }
}
