import { Injectable, NotFoundException } from '@nestjs/common';
import {
  WorkflowExecutionStatus,
  WorkflowStepExecutionStatus,
  WorkflowStepType,
  OrganizationRole,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { WorkflowStepExecutorService } from './workflow-step-executor.service';
import { WorkflowQueueService } from './workflow-queue.service';
import { WorkflowService } from './workflow.service';
import {
  ExecutionCheckpoint,
  WorkflowGraphEngine,
  WorkflowStepRow,
} from './workflow-graph.engine';
import { WORKFLOW_RETRY_ATTEMPTS } from './workflow.constants';

@Injectable()
export class WorkflowRunnerService {
  private readonly graph = new WorkflowGraphEngine();

  constructor(
    private prisma: PrismaService,
    private executor: WorkflowStepExecutorService,
    private queue: WorkflowQueueService,
    private workflows: WorkflowService,
  ) {}

  async startRun(
    workflowId: string,
    organizationId: string,
    triggerData: Record<string, unknown>,
    attempt = 1,
    options?: { sourceTemplateId?: string },
  ) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, organizationId, isActive: true },
      include: {
        currentVersion: { include: { steps: { orderBy: { position: 'asc' } } } },
      },
    });
    if (!workflow?.currentVersion) throw new NotFoundException('Active workflow version not found');

    const execution = await this.prisma.workflowExecution.create({
      data: {
        organizationId,
        workflowId,
        workflowVersionId: workflow.currentVersion.id,
        status: WorkflowExecutionStatus.PENDING,
        triggerData: triggerData as object,
        attempt,
        sourceTemplateId: options?.sourceTemplateId,
      },
    });

    await this.queue.enqueueRun({
      executionId: execution.id,
      organizationId,
      workflowId,
      attempt,
    });

    return execution;
  }

  async runExecution(executionId: string, attempt = 1) {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        workflow: true,
        version: { include: { steps: { orderBy: { position: 'asc' } } } },
      },
    });
    if (!execution) throw new NotFoundException('Execution not found');

    const steps = execution.version.steps as WorkflowStepRow[];
    const stepMap = new Map(steps.map((s) => [s.stepKey, s]));
    const definition = this.graph.parseDefinition(execution.version.definition, steps);
    const savedCheckpoint = this.parseCheckpoint(execution.checkpoint);
    const isResume = savedCheckpoint.nextStepKeys.length > 0;
    const started = isResume && execution.startedAt ? execution.startedAt.getTime() : Date.now();

    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: WorkflowExecutionStatus.RUNNING,
        startedAt: execution.startedAt ?? new Date(),
        attempt,
        checkpoint: {},
        resumeAt: null,
      },
    });

    const tenant = await this.buildTenant(execution.organizationId, execution.workflow.createdById);
    const context: Record<string, unknown> = savedCheckpoint.context?.trigger
      ? savedCheckpoint.context
      : { trigger: execution.triggerData, steps: {} };

    if (!context.steps || typeof context.steps !== 'object') {
      context.steps = savedCheckpoint.context?.steps ?? {};
    }

    let skipRemaining = savedCheckpoint.skipRemaining ?? false;
    const visited = new Set<string>(savedCheckpoint.visitedStepKeys ?? []);
    let queue: string[] = isResume
      ? savedCheckpoint.nextStepKeys
      : [this.graph.getStartStepKey(steps, definition)];

    try {
      while (queue.length > 0) {
        const batch = [...new Set(queue.filter((k) => !visited.has(k) || this.isParallelJoin(stepMap, k)))];
        queue = [];

        if (batch.length > 1) {
          const parallelResults = await Promise.all(
            batch.map((stepKey) =>
              this.runSingleStep(executionId, stepKey, stepMap, definition, tenant, context, visited, skipRemaining),
            ),
          );
          for (const pr of parallelResults) {
            if (pr.skipRemaining) skipRemaining = true;
            if (pr.asyncWait) {
              return this.scheduleAsyncWait(executionId, execution, context, visited, pr, attempt, started);
            }
            queue.push(...pr.nextStepKeys.filter((k) => stepMap.has(k)));
          }
          continue;
        }

        const stepKey = batch[0];
        if (!stepKey) break;

        const pr = await this.runSingleStep(
          executionId, stepKey, stepMap, definition, tenant, context, visited, skipRemaining,
        );

        if (pr.skipRemaining) skipRemaining = true;
        if (pr.asyncWait) {
          return this.scheduleAsyncWait(executionId, execution, context, visited, pr, attempt, started);
        }

        queue.push(...pr.nextStepKeys.filter((k) => stepMap.has(k)));
      }

      const durationMs = Date.now() - started;
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: WorkflowExecutionStatus.COMPLETED,
          finishedAt: new Date(),
          durationMs,
          result: context as object,
          checkpoint: {},
        },
      });
      return { status: WorkflowExecutionStatus.COMPLETED, durationMs };
    } catch (e) {
      const durationMs = Date.now() - started;
      const err = e instanceof Error ? e.message : String(e);

      if (attempt < WORKFLOW_RETRY_ATTEMPTS) {
        await this.prisma.workflowExecution.update({
          where: { id: executionId },
          data: { status: WorkflowExecutionStatus.PENDING, error: err, durationMs },
        });
        await this.queue.enqueueRetry({
          executionId,
          organizationId: execution.organizationId,
          workflowId: execution.workflowId,
          attempt,
        });
        return { status: WorkflowExecutionStatus.PENDING, retry: true, error: err };
      }

      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: WorkflowExecutionStatus.DLQ,
          finishedAt: new Date(),
          durationMs,
          error: err,
        },
      });
      await this.queue.enqueueDlq({
        executionId,
        organizationId: execution.organizationId,
        workflowId: execution.workflowId,
        error: err,
      });
      return { status: WorkflowExecutionStatus.DLQ, error: err };
    }
  }

  async recoverFromDlq(tenant: TenantContext, executionId: string) {
    const ex = await this.prisma.workflowExecution.findFirst({
      where: { id: executionId, organizationId: tenant.organizationId },
    });
    if (!ex) throw new NotFoundException('Execution not found');
    if (ex.status !== WorkflowExecutionStatus.DLQ) {
      throw new NotFoundException('Execution is not in DLQ');
    }

    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: WorkflowExecutionStatus.PENDING, error: null, attempt: 1, finishedAt: null },
    });

    await this.queue.enqueueRun({
      executionId,
      organizationId: ex.organizationId,
      workflowId: ex.workflowId,
      attempt: 1,
    });

    return { recovered: true, executionId };
  }

  async listExecutions(tenant: TenantContext, workflowId?: string) {
    return this.prisma.workflowExecution.findMany({
      where: {
        organizationId: tenant.organizationId,
        ...(workflowId ? { workflowId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        workflow: { select: { id: true, name: true } },
        logs: { orderBy: { createdAt: 'asc' }, include: { step: true } },
      },
    });
  }

  async getExecution(tenant: TenantContext, executionId: string) {
    const ex = await this.prisma.workflowExecution.findFirst({
      where: { id: executionId, organizationId: tenant.organizationId },
      include: {
        workflow: { select: { id: true, name: true } },
        logs: { orderBy: { createdAt: 'asc' }, include: { step: true } },
      },
    });
    if (!ex) throw new NotFoundException('Execution not found');
    return ex;
  }

  private async runSingleStep(
    executionId: string,
    stepKey: string,
    stepMap: Map<string, WorkflowStepRow>,
    definition: ReturnType<WorkflowGraphEngine['parseDefinition']>,
    tenant: TenantContext,
    context: Record<string, unknown>,
    visited: Set<string>,
    skipRemaining: boolean,
  ) {
    const step = stepMap.get(stepKey);
    if (!step) return { nextStepKeys: [] as string[], skipRemaining: false, asyncWait: false, waitMs: 0 };

    if (skipRemaining && step.stepType !== WorkflowStepType.END) {
      await this.logStep(executionId, step.id, WorkflowStepExecutionStatus.SKIPPED, {}, {}, 0);
      visited.add(stepKey);
      return { nextStepKeys: [], skipRemaining: true, asyncWait: false, waitMs: 0 };
    }

    if (visited.has(stepKey) && step.stepType !== WorkflowStepType.END) {
      return { nextStepKeys: [], skipRemaining, asyncWait: false, waitMs: 0 };
    }

    visited.add(stepKey);
    const stepStarted = Date.now();
    const input = { ...context };
    const config = (step.configuration ?? {}) as Record<string, unknown>;

    try {
      const result = await this.executor.execute(tenant, step.stepType, config, context);
      context.steps = { ...(context.steps as object), [step.stepKey]: result.output };

      await this.logStep(
        executionId, step.id, WorkflowStepExecutionStatus.COMPLETED,
        input, result.output, Date.now() - stepStarted,
      );

      return {
        nextStepKeys: this.graph.resolveNextStepKeys(step, result, definition),
        skipRemaining: result.skipRemaining ?? false,
        asyncWait: result.asyncWait ?? false,
        waitMs: result.waitMs ?? 0,
      };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      await this.logStep(
        executionId, step.id, WorkflowStepExecutionStatus.FAILED,
        input, { error: err }, Date.now() - stepStarted, err,
      );
      throw e;
    }
  }

  private async scheduleAsyncWait(
    executionId: string,
    execution: { organizationId: string; workflowId: string },
    context: Record<string, unknown>,
    visited: Set<string>,
    pr: { nextStepKeys: string[]; waitMs: number },
    attempt: number,
    started: number,
  ) {
    const resumeAt = new Date(Date.now() + pr.waitMs);
    const checkpoint: ExecutionCheckpoint = {
      context,
      nextStepKeys: pr.nextStepKeys,
      visitedStepKeys: [...visited],
    };

    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: WorkflowExecutionStatus.WAITING,
        checkpoint: checkpoint as object,
        resumeAt,
        durationMs: Date.now() - started,
      },
    });

    await this.queue.enqueueRun(
      {
        executionId,
        organizationId: execution.organizationId,
        workflowId: execution.workflowId,
        attempt,
        resume: true,
      },
      pr.waitMs,
    );

    return { status: WorkflowExecutionStatus.WAITING, resumeAt, waitMs: pr.waitMs };
  }

  private parseCheckpoint(raw: unknown): ExecutionCheckpoint {
    const cp = (raw ?? {}) as Partial<ExecutionCheckpoint>;
    return {
      context: (cp.context as Record<string, unknown>) ?? {},
      nextStepKeys: Array.isArray(cp.nextStepKeys) ? cp.nextStepKeys : [],
      visitedStepKeys: Array.isArray(cp.visitedStepKeys) ? cp.visitedStepKeys : [],
      skipRemaining: cp.skipRemaining ?? false,
    };
  }

  private isParallelJoin(stepMap: Map<string, WorkflowStepRow>, stepKey: string) {
    return stepMap.get(stepKey)?.stepType === WorkflowStepType.END;
  }

  private async logStep(
    executionId: string,
    stepId: string,
    status: WorkflowStepExecutionStatus,
    input: Record<string, unknown>,
    output: Record<string, unknown>,
    latencyMs: number,
    error?: string,
  ) {
    await this.prisma.workflowExecutionLog.create({
      data: {
        executionId, stepId, status,
        input: input as object,
        output: output as object,
        latencyMs,
        error,
      },
    });
  }

  private async buildTenant(organizationId: string, userId: string): Promise<TenantContext> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId, userId },
    });
    return {
      organizationId,
      userId,
      email: user?.email ?? 'workflow@system',
      role: user?.role ?? UserRole.USER,
      organizationRole: member?.role ?? OrganizationRole.OPERATOR,
    };
  }
}
