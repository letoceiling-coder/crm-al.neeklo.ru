import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KnowledgeJobService } from '../jobs/knowledge-job.service';
import { KnowledgeStatsService } from '../knowledge-stats.service';
import { EmbeddingClientService } from './embedding-client.service';
import { EmbeddingStoreService } from './embedding-store.service';
import { KnowledgeEmbeddingStatus, KnowledgeJobStatus } from '@prisma/client';
import { WorkflowTriggerService } from '../../workflows/workflow-trigger.service';

const EMBED_BATCH = 32;

@Injectable()
export class EmbeddingRunnerService {
  private readonly logger = new Logger(EmbeddingRunnerService.name);

  constructor(
    private prisma: PrismaService,
    private client: EmbeddingClientService,
    private store: EmbeddingStoreService,
    private jobs: KnowledgeJobService,
    private stats: KnowledgeStatsService,
    @Optional() @Inject(forwardRef(() => WorkflowTriggerService))
    private workflowTriggers?: WorkflowTriggerService,
  ) {}

  async embedDocumentChunks(params: {
    jobId: string;
    organizationId: string;
    knowledgeBaseId: string;
    documentId: string;
    profileId?: string;
  }) {
    await this.jobs.markRunning(params.jobId, 20);

    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id: params.knowledgeBaseId },
    });
    const profileId = params.profileId ?? kb?.embeddingProfileId;
    if (!profileId) {
      await this.jobs.markFinished(params.jobId, KnowledgeJobStatus.FAILED, 0, 'No embedding profile');
      return;
    }

    const profile = await this.prisma.embeddingProfile.findUnique({ where: { id: profileId } });
    if (!profile?.isActive) {
      await this.jobs.markFinished(params.jobId, KnowledgeJobStatus.FAILED, 0, 'Profile inactive');
      return;
    }

    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: { documentId: params.documentId, organizationId: params.organizationId },
      orderBy: { chunkIndex: 'asc' },
    });

    if (!chunks.length) {
      await this.prisma.knowledgeDocument.update({
        where: { id: params.documentId },
        data: { embeddingStatus: KnowledgeEmbeddingStatus.INDEXED, chunkCount: 0 },
      });
      await this.jobs.markFinished(params.jobId, KnowledgeJobStatus.SUCCESS, 100);
      return;
    }

    await this.store.deleteForDocument(params.documentId, profileId);

    let done = 0;
    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      const batch = chunks.slice(i, i + EMBED_BATCH);
      const vectors = await this.client.embedTexts(
        profile,
        batch.map((c) => c.content),
        params.organizationId,
      );

      for (let j = 0; j < batch.length; j++) {
        const vector = vectors[j];
        if (!vector?.length) continue;
        await this.store.upsertEmbedding({
          chunkId: batch[j].id,
          profileId: profile.id,
          dimensions: profile.dimensions,
          vector,
        });
      }
      done += batch.length;
      const progress = 20 + Math.round((done / chunks.length) * 70);
      await this.jobs.markRunning(params.jobId, progress);
    }

    await this.prisma.knowledgeDocument.update({
      where: { id: params.documentId },
      data: {
        embeddingStatus: KnowledgeEmbeddingStatus.INDEXED,
        chunkCount: chunks.length,
        metadata: {
          ...(await this.getDocMetadata(params.documentId)),
          embeddingProfileId: profile.id,
          embeddingModel: profile.model,
        },
      },
    });

    void this.workflowTriggers?.emitKbEvent(params.organizationId, 'DOCUMENT_INDEXED', {
      documentId: params.documentId,
      knowledgeBaseId: params.knowledgeBaseId,
      chunkCount: chunks.length,
    });

    await this.stats.refresh(params.knowledgeBaseId);
    await this.jobs.markFinished(params.jobId, KnowledgeJobStatus.SUCCESS, 100);
  }

  async reembedKnowledgeBase(params: {
    jobId: string;
    organizationId: string;
    knowledgeBaseId: string;
    profileId?: string;
  }) {
    await this.jobs.markRunning(params.jobId, 5);
    const docs = await this.prisma.knowledgeDocument.findMany({
      where: {
        knowledgeBaseId: params.knowledgeBaseId,
        organizationId: params.organizationId,
        status: 'READY',
      },
      select: { id: true },
    });

    const kb = await this.prisma.knowledgeBase.findUnique({ where: { id: params.knowledgeBaseId } });
    const profileId = params.profileId ?? kb?.embeddingProfileId;
    if (profileId) {
      await this.store.deleteForKnowledgeBase(params.knowledgeBaseId, profileId);
    }

    let i = 0;
    for (const doc of docs) {
      const chunks = await this.prisma.knowledgeChunk.findMany({
        where: { documentId: doc.id },
        orderBy: { chunkIndex: 'asc' },
      });
      if (!chunks.length) continue;

      const profile = await this.prisma.embeddingProfile.findUnique({
        where: { id: profileId! },
      });
      if (!profile) break;

      for (let b = 0; b < chunks.length; b += EMBED_BATCH) {
        const batch = chunks.slice(b, b + EMBED_BATCH);
        const vectors = await this.client.embedTexts(
          profile,
          batch.map((c) => c.content),
          params.organizationId,
        );
        for (let j = 0; j < batch.length; j++) {
          if (!vectors[j]?.length) continue;
          await this.store.upsertEmbedding({
            chunkId: batch[j].id,
            profileId: profile.id,
            dimensions: profile.dimensions,
            vector: vectors[j],
          });
        }
      }

      await this.prisma.knowledgeDocument.update({
        where: { id: doc.id },
        data: { embeddingStatus: KnowledgeEmbeddingStatus.INDEXED },
      });
      i++;
      await this.jobs.markRunning(params.jobId, 5 + Math.round((i / docs.length) * 90));
    }

    await this.stats.refresh(params.knowledgeBaseId);
    await this.jobs.markFinished(params.jobId, KnowledgeJobStatus.SUCCESS, 100);
  }

  private async getDocMetadata(documentId: string): Promise<Record<string, unknown>> {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id: documentId } });
    return typeof doc?.metadata === 'object' && doc.metadata ? (doc.metadata as Record<string, unknown>) : {};
  }
}
