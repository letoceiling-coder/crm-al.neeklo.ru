import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { JOB_NAMES, QUEUE_NAMES } from '../../queue/queue.constants';
import { ChunkRunnerService } from '../chunking/chunk-runner.service';
import { EmbeddingRunnerService } from '../embedding/embedding-runner.service';
import { ChunkingService } from '../chunking/chunking.service';
import type { ChunkJobPayload, EmbedJobPayload, ReembedJobPayload } from './knowledge-job.types';
import { KnowledgeJobService } from './knowledge-job.service';
import { KnowledgeJobStatus } from '@prisma/client';

@Processor(QUEUE_NAMES.KNOWLEDGE_CHUNK)
export class KnowledgeChunkProcessor extends WorkerHost {
  constructor(private runner: ChunkRunnerService) {
    super();
  }

  async process(job: Job) {
    if (job.name === JOB_NAMES.CHUNK) {
      return this.runner.runChunk(job.data as ChunkJobPayload);
    }
  }
}

@Processor(QUEUE_NAMES.KNOWLEDGE_EMBED)
export class KnowledgeEmbedProcessor extends WorkerHost {
  constructor(private runner: EmbeddingRunnerService) {
    super();
  }

  async process(job: Job) {
    if (job.name === JOB_NAMES.EMBED) {
      return this.runner.embedDocumentChunks(job.data as EmbedJobPayload);
    }
  }
}

@Processor(QUEUE_NAMES.KNOWLEDGE_REEMBED)
export class KnowledgeReembedProcessor extends WorkerHost {
  constructor(
    private runner: EmbeddingRunnerService,
    private chunking: ChunkingService,
    private jobs: KnowledgeJobService,
  ) {
    super();
  }

  async process(job: Job) {
    if (job.name !== JOB_NAMES.REEMBED) return;
    const payload = job.data as ReembedJobPayload;
    await this.jobs.markRunning(payload.jobId, 5);

    try {
      if (payload.documentId) {
        await this.chunking.chunkDocument({
          organizationId: payload.organizationId,
          knowledgeBaseId: payload.knowledgeBaseId,
          documentId: payload.documentId,
        });
        await this.runner.embedDocumentChunks({
          jobId: payload.jobId,
          organizationId: payload.organizationId,
          knowledgeBaseId: payload.knowledgeBaseId,
          documentId: payload.documentId,
          profileId: payload.profileId,
        });
      } else {
        await this.runner.reembedKnowledgeBase(payload);
      }
    } catch (err) {
      await this.jobs.markFinished(payload.jobId, KnowledgeJobStatus.FAILED, 0, (err as Error).message);
    }
  }
}
