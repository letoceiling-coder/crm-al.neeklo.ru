import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queue.constants';

export interface QueueMetrics {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  lagMs: number | null;
  throughputPerMin: number;
  retryRate: number;
  dlqCount?: number;
  health: 'healthy' | 'degraded' | 'critical';
}

const MONITORED_QUEUES = [
  QUEUE_NAMES.KNOWLEDGE_INGEST,
  QUEUE_NAMES.KNOWLEDGE_CHUNK,
  QUEUE_NAMES.KNOWLEDGE_EMBED,
  QUEUE_NAMES.KNOWLEDGE_REEMBED,
  QUEUE_NAMES.MEMORY_SUMMARIZE,
  QUEUE_NAMES.WORKFLOW_RUN,
  QUEUE_NAMES.WORKFLOW_RETRY,
  QUEUE_NAMES.WORKFLOW_DLQ,
  QUEUE_NAMES.INTEGRATION_EVENTS,
  QUEUE_NAMES.TOOL_EXECUTION,
] as const;

@Injectable()
export class SystemQueueService {
  private readonly queues: Record<string, Queue>;

  constructor(
    @InjectQueue(QUEUE_NAMES.KNOWLEDGE_INGEST) q1: Queue,
    @InjectQueue(QUEUE_NAMES.KNOWLEDGE_CHUNK) q2: Queue,
    @InjectQueue(QUEUE_NAMES.KNOWLEDGE_EMBED) q3: Queue,
    @InjectQueue(QUEUE_NAMES.KNOWLEDGE_REEMBED) q4: Queue,
    @InjectQueue(QUEUE_NAMES.MEMORY_SUMMARIZE) q5: Queue,
    @InjectQueue(QUEUE_NAMES.WORKFLOW_RUN) q6: Queue,
    @InjectQueue(QUEUE_NAMES.WORKFLOW_RETRY) q7: Queue,
    @InjectQueue(QUEUE_NAMES.WORKFLOW_DLQ) q8: Queue,
    @InjectQueue(QUEUE_NAMES.INTEGRATION_EVENTS) q9: Queue,
    @InjectQueue(QUEUE_NAMES.TOOL_EXECUTION) q10: Queue,
  ) {
    this.queues = {
      [QUEUE_NAMES.KNOWLEDGE_INGEST]: q1,
      [QUEUE_NAMES.KNOWLEDGE_CHUNK]: q2,
      [QUEUE_NAMES.KNOWLEDGE_EMBED]: q3,
      [QUEUE_NAMES.KNOWLEDGE_REEMBED]: q4,
      [QUEUE_NAMES.MEMORY_SUMMARIZE]: q5,
      [QUEUE_NAMES.WORKFLOW_RUN]: q6,
      [QUEUE_NAMES.WORKFLOW_RETRY]: q7,
      [QUEUE_NAMES.WORKFLOW_DLQ]: q8,
      [QUEUE_NAMES.INTEGRATION_EVENTS]: q9,
      [QUEUE_NAMES.TOOL_EXECUTION]: q10,
    };
  }

  async getQueueMetrics(): Promise<{ redis: boolean; queues: QueueMetrics[]; summary: Record<string, number> }> {
    const metrics: QueueMetrics[] = [];
    let redisOk = false;

    try {
      const client = await this.queues[QUEUE_NAMES.KNOWLEDGE_INGEST].client;
      redisOk = client.status === 'ready';
    } catch {
      redisOk = false;
    }

    const dlqFailed = await this.queues[QUEUE_NAMES.WORKFLOW_DLQ]?.getFailedCount().catch(() => 0);

    for (const name of MONITORED_QUEUES) {
      const queue = this.queues[name];
      if (!queue) continue;

      const [waiting, active, completed, failed, delayed, isPaused, oldestWaiting] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused(),
        queue.getWaiting(0, 0),
      ]);

      const oldest = oldestWaiting[0];
      const lagMs = oldest?.timestamp ? Date.now() - oldest.timestamp : null;
      const total = completed + failed || 1;
      const retryRate = name === QUEUE_NAMES.WORKFLOW_RETRY ? failed / total : 0;
      const throughputPerMin = completed > 0 ? Math.min(completed, 9999) : 0;

      let health: QueueMetrics['health'] = 'healthy';
      if (failed > 50 || (lagMs !== null && lagMs > 300_000)) health = 'critical';
      else if (failed > 5 || waiting > 100 || (lagMs !== null && lagMs > 60_000)) health = 'degraded';

      metrics.push({
        name,
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused: isPaused,
        lagMs,
        throughputPerMin,
        retryRate: Math.round(retryRate * 1000) / 1000,
        dlqCount: name === QUEUE_NAMES.WORKFLOW_DLQ ? failed : undefined,
        health,
      });
    }

    const summary = {
      totalWaiting: metrics.reduce((s, q) => s + q.waiting, 0),
      totalActive: metrics.reduce((s, q) => s + q.active, 0),
      totalFailed: metrics.reduce((s, q) => s + q.failed, 0),
      dlqTotal: dlqFailed,
      degradedQueues: metrics.filter((q) => q.health !== 'healthy').length,
    };

    return { redis: redisOk, queues: metrics, summary };
  }
}
