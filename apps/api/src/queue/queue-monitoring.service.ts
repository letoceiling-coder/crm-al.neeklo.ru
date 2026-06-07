import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from './queue.constants';

@Injectable()
export class QueueMonitoringService {
  constructor(
    @InjectQueue(QUEUE_NAMES.KNOWLEDGE_INGEST) private knowledgeIngest: Queue,
    @InjectQueue(QUEUE_NAMES.KNOWLEDGE_REEMBED) private knowledgeReembed: Queue,
    @InjectQueue(QUEUE_NAMES.MEMORY_SUMMARIZE) private memorySummarize: Queue,
    @InjectQueue(QUEUE_NAMES.WORKFLOW_RUN) private workflowRun: Queue,
    @InjectQueue(QUEUE_NAMES.PARSER_JOBS) private parserJobs: Queue,
  ) {}

  private get queues(): Record<string, Queue> {
    return {
      [QUEUE_NAMES.KNOWLEDGE_INGEST]: this.knowledgeIngest,
      [QUEUE_NAMES.KNOWLEDGE_REEMBED]: this.knowledgeReembed,
      [QUEUE_NAMES.MEMORY_SUMMARIZE]: this.memorySummarize,
      [QUEUE_NAMES.WORKFLOW_RUN]: this.workflowRun,
      [QUEUE_NAMES.PARSER_JOBS]: this.parserJobs,
    };
  }

  async getHealth() {
    const queues: Record<string, { waiting: number; active: number; failed: number }> = {};
    for (const [name, queue] of Object.entries(this.queues)) {
      const [waiting, active, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getFailedCount(),
      ]);
      queues[name] = { waiting, active, failed };
    }

    let redisOk = false;
    try {
      const client = await this.knowledgeIngest.client;
      redisOk = client.status === 'ready';
    } catch {
      redisOk = false;
    }

    return { redis: redisOk, queues };
  }
}
