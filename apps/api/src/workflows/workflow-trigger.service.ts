import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { WorkflowTriggerType } from '@prisma/client';
import { WorkflowRunnerService } from './workflow-runner.service';
import { WorkflowQueueService } from './workflow-queue.service';
import { WorkflowService } from './workflow.service';

@Injectable()
export class WorkflowTriggerService {
  private readonly logger = new Logger(WorkflowTriggerService.name);

  constructor(
    private workflows: WorkflowService,
    @Inject(forwardRef(() => WorkflowRunnerService))
    private runner: WorkflowRunnerService,
    private queue: WorkflowQueueService,
  ) {}

  async emitCrmEvent(organizationId: string, event: string, payload: Record<string, unknown>) {
    return this.emit(organizationId, WorkflowTriggerType.CRM_EVENT, event, payload);
  }

  async emitKbEvent(organizationId: string, event: string, payload: Record<string, unknown>) {
    return this.emit(organizationId, WorkflowTriggerType.KB_EVENT, event, payload);
  }

  async emitToolEvent(organizationId: string, event: string, payload: Record<string, unknown>) {
    return this.emit(organizationId, WorkflowTriggerType.TOOL_EVENT, event, payload);
  }

  async emitIntegrationEvent(organizationId: string, event: string, payload: Record<string, unknown>) {
    return this.emit(organizationId, WorkflowTriggerType.INTEGRATION_EVENT, event, payload);
  }

  async emitWebhook(token: string, payload: Record<string, unknown>) {
    const workflow = await this.workflows.findByWebhookToken(token);
    return this.runner.startRun(workflow.id, workflow.organizationId, {
      ...payload,
      event: 'WEBHOOK',
    });
  }

  async registerScheduleIfNeeded(
    workflowId: string,
    organizationId: string,
    cron?: string | null,
    timezone?: string | null,
  ) {
    if (!cron) {
      await this.queue.removeSchedule(workflowId);
      return;
    }
    await this.queue.registerSchedule(workflowId, organizationId, cron, timezone ?? 'UTC');
  }

  private async emit(
    organizationId: string,
    triggerType: WorkflowTriggerType,
    event: string,
    payload: Record<string, unknown>,
  ) {
    const matched = await this.workflows.findActiveByTrigger(organizationId, triggerType, event);
    const results = [];
    for (const w of matched) {
      try {
        const execution = await this.runner.startRun(w.id, organizationId, {
          event,
          ...payload,
        });
        results.push({ workflowId: w.id, executionId: execution.id });
      } catch (e) {
        this.logger.warn(`Failed to start workflow ${w.id}: ${e}`);
      }
    }
    return results;
  }
}
