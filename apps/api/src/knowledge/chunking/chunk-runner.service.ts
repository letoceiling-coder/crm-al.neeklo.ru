import { Injectable, Logger } from '@nestjs/common';
import { ChunkingService } from '../chunking/chunking.service';
import { KnowledgeJobService } from '../jobs/knowledge-job.service';
import { KnowledgeQueueService } from '../jobs/knowledge-queue.service';
import { KnowledgeEmbeddingStatus, KnowledgeJobStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ChunkJobPayload } from '../jobs/knowledge-job.types';

@Injectable()
export class ChunkRunnerService {
  private readonly logger = new Logger(ChunkRunnerService.name);

  constructor(
    private chunking: ChunkingService,
    private jobs: KnowledgeJobService,
    private queue: KnowledgeQueueService,
    private prisma: PrismaService,
  ) {}

  async runChunk(payload: ChunkJobPayload) {
    await this.jobs.markRunning(payload.jobId, 10);
    try {
      const { chunkIds } = await this.chunking.chunkDocument(payload);
      if (!chunkIds.length) {
        await this.prisma.knowledgeDocument.update({
          where: { id: payload.documentId },
          data: { embeddingStatus: KnowledgeEmbeddingStatus.INDEXED },
        });
        await this.jobs.markFinished(payload.jobId, KnowledgeJobStatus.SUCCESS, 100);
        return;
      }

      await this.queue.enqueueEmbed({
        organizationId: payload.organizationId,
        knowledgeBaseId: payload.knowledgeBaseId,
        documentId: payload.documentId,
        parentJobId: payload.jobId,
      });

      await this.jobs.markFinished(payload.jobId, KnowledgeJobStatus.SUCCESS, 100);
    } catch (err) {
      this.logger.warn(`Chunk failed: ${(err as Error).message}`);
      await this.prisma.knowledgeDocument.update({
        where: { id: payload.documentId },
        data: { embeddingStatus: KnowledgeEmbeddingStatus.FAILED },
      });
      await this.jobs.markFinished(payload.jobId, KnowledgeJobStatus.FAILED, 0, (err as Error).message);
    }
  }
}
