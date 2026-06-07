import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES, JOB_NAMES } from '../queue/queue.constants';
import { WorkflowRunnerService } from './workflow-runner.service';
import { WorkflowRunJobPayload, WorkflowScheduleJobPayload } from './workflow-queue.service';

@Processor(QUEUE_NAMES.WORKFLOW_RUN)
export class WorkflowRunProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowRunProcessor.name);

  constructor(private runner: WorkflowRunnerService) {
    super();
  }

  async process(job: Job<WorkflowRunJobPayload>) {
    if (job.name !== JOB_NAMES.WORKFLOW_RUN) return;
    this.logger.log(`Running workflow execution ${job.data.executionId}`);
    return this.runner.runExecution(job.data.executionId, job.data.attempt ?? 1);
  }
}

@Processor(QUEUE_NAMES.WORKFLOW_RETRY)
export class WorkflowRetryProcessor extends WorkerHost {
  constructor(private runner: WorkflowRunnerService) {
    super();
  }

  async process(job: Job<WorkflowRunJobPayload>) {
    if (job.name !== JOB_NAMES.WORKFLOW_RUN) return;
    return this.runner.runExecution(job.data.executionId, job.data.attempt ?? 2);
  }
}

@Processor(QUEUE_NAMES.WORKFLOW_SCHEDULE)
export class WorkflowScheduleProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowScheduleProcessor.name);

  constructor(private runner: WorkflowRunnerService) {
    super();
  }

  async process(job: Job<WorkflowScheduleJobPayload>) {
    if (job.name !== JOB_NAMES.WORKFLOW_SCHEDULE_TICK) return;
    this.logger.log(`Schedule tick for workflow ${job.data.workflowId}`);
    return this.runner.startRun(job.data.workflowId, job.data.organizationId, {
      event: 'SCHEDULE',
      scheduledAt: new Date().toISOString(),
    });
  }
}

@Processor(QUEUE_NAMES.WORKFLOW_DLQ)
export class WorkflowDlqProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowDlqProcessor.name);

  async process(job: Job) {
    this.logger.error(`Workflow DLQ: ${JSON.stringify(job.data)}`);
    return { dlq: true };
  }
}
