import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../queue/queue.constants';
import { WORKFLOW_RETRY_ATTEMPTS, WORKFLOW_RETRY_BACKOFF_MS } from './workflow.constants';

export interface WorkflowRunJobPayload {
  executionId: string;
  organizationId: string;
  workflowId: string;
  attempt?: number;
  resume?: boolean;
}

export interface WorkflowScheduleJobPayload {
  workflowId: string;
  organizationId: string;
}

@Injectable()
export class WorkflowQueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.WORKFLOW_RUN) private runQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WORKFLOW_SCHEDULE) private scheduleQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WORKFLOW_RETRY) private retryQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WORKFLOW_DLQ) private dlqQueue: Queue,
  ) {}

  async enqueueRun(payload: WorkflowRunJobPayload, delayMs = 0) {
    const queue = (payload.attempt ?? 0) > 1 ? this.retryQueue : this.runQueue;
    const attempt = payload.attempt ?? 1;
    return queue.add(JOB_NAMES.WORKFLOW_RUN, payload, {
      delay: delayMs,
      attempts: WORKFLOW_RETRY_ATTEMPTS,
      backoff: {
        type: 'custom',
      },
      removeOnComplete: 100,
      removeOnFail: false,
    });
  }

  async enqueueRetry(payload: WorkflowRunJobPayload) {
    const attempt = (payload.attempt ?? 1) + 1;
    const delayMs = WORKFLOW_RETRY_BACKOFF_MS[Math.min(attempt - 2, WORKFLOW_RETRY_BACKOFF_MS.length - 1)] ?? 5000;
    return this.enqueueRun({ ...payload, attempt }, delayMs);
  }

  async enqueueDlq(payload: WorkflowRunJobPayload & { error: string }) {
    return this.dlqQueue.add(JOB_NAMES.WORKFLOW_RUN, payload, {
      removeOnComplete: false,
      removeOnFail: false,
    });
  }

  async registerSchedule(workflowId: string, organizationId: string, cron: string, timezone = 'UTC') {
    await this.removeSchedule(workflowId);
    await this.scheduleQueue.add(
      JOB_NAMES.WORKFLOW_SCHEDULE_TICK,
      { workflowId, organizationId } satisfies WorkflowScheduleJobPayload,
      {
        repeat: { pattern: cron, tz: timezone },
        jobId: `workflow-schedule-${workflowId}`,
        removeOnComplete: true,
      },
    );
  }

  async removeSchedule(workflowId: string) {
    const repeatable = await this.scheduleQueue.getRepeatableJobs();
    for (const job of repeatable) {
      if (job.id === `workflow-schedule-${workflowId}`) {
        await this.scheduleQueue.removeRepeatableByKey(job.key);
      }
    }
  }
}
