import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  OrganizationRole,
  UserRole,
  WorkflowTriggerType,
  WorkflowStepType,
  WorkflowExecutionStatus,
} from '@prisma/client';
import { WorkflowService } from './workflow.service';
import { WorkflowRunnerService } from './workflow-runner.service';
import { WorkflowTriggerService } from './workflow-trigger.service';
import { WorkflowStepExecutorService } from './workflow-step-executor.service';
import { WorkflowQueueService } from './workflow-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssistantChatService } from '../assistants/assistant-chat.service';
import { ToolExecutionService } from '../tools/tool-execution.service';
import { CrmToolService } from '../crm/crm-tool.service';
import { CrmLeadService } from '../crm/crm-lead.service';
import { CrmClientService } from '../crm/crm-client.service';
import { CrmTaskService } from '../crm/crm-task.service';
import { CrmNoteService } from '../crm/crm-note.service';
import { MemorySearchService } from '../memory/memory-search.service';
import { MemoryEntryService } from '../memory/memory-entry.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

const tenant: TenantContext = {
  organizationId: 'org-1',
  userId: 'user-1',
  email: 'u@test.io',
  role: UserRole.USER,
  organizationRole: OrganizationRole.OPERATOR,
};

describe('Stage 6 — Workflow Engine', () => {
  describe('WorkflowService — CRUD & versioning', () => {
    let service: WorkflowService;
    const prisma = {
      workflow: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      workflowVersion: { findFirst: jest.fn(), create: jest.fn() },
      workflowStep: { createMany: jest.fn() },
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [WorkflowService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      service = module.get(WorkflowService);
    });

    it('lists workflows scoped to organization', async () => {
      prisma.workflow.findMany.mockResolvedValue([]);
      await service.list(tenant);
      expect(prisma.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1' } }),
      );
    });

    it('rejects cross-tenant access', async () => {
      prisma.workflow.findUnique.mockResolvedValue({ id: 'w1', organizationId: 'org-other' });
      await expect(service.assertOwned('w1', 'org-1')).rejects.toThrow(ForbiddenException);
    });

    it('creates workflow with initial version and START/END steps', async () => {
      prisma.workflow.create.mockResolvedValue({ id: 'w1' });
      prisma.workflowVersion.create.mockResolvedValue({ id: 'v1' });
      prisma.workflow.update.mockResolvedValue({
        id: 'w1',
        currentVersion: { steps: [] },
      });

      await service.create(tenant, {
        name: 'Test Flow',
        triggerType: WorkflowTriggerType.MANUAL,
      });

      expect(prisma.workflowVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ workflowId: 'w1', version: 1 }) }),
      );
      expect(prisma.workflowStep.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ stepType: WorkflowStepType.START }),
            expect.objectContaining({ stepType: WorkflowStepType.END }),
          ]),
        }),
      );
    });

    it('creates new version when steps are updated', async () => {
      prisma.workflow.findUnique.mockResolvedValue({ id: 'w1', organizationId: 'org-1' });
      prisma.workflowVersion.findFirst.mockResolvedValue({ version: 2 });
      prisma.workflowVersion.create.mockResolvedValue({ id: 'v3' });
      prisma.workflow.update.mockResolvedValue({ id: 'w1', currentVersion: { steps: [] } });

      await service.update(tenant, 'w1', {
        steps: [
          { stepKey: 'start', stepType: WorkflowStepType.START, position: 0 },
          { stepKey: 'a1', stepType: WorkflowStepType.ASSISTANT, position: 1, configuration: {} },
          { stepKey: 'end', stepType: WorkflowStepType.END, position: 2 },
        ],
      });

      expect(prisma.workflowVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ version: 3 }) }),
      );
    });
  });

  describe('WorkflowTriggerService — events & webhook', () => {
    let service: WorkflowTriggerService;
    const workflows = {
      findActiveByTrigger: jest.fn(),
      findByWebhookToken: jest.fn(),
    };
    const runner = { startRun: jest.fn().mockResolvedValue({ id: 'exec-1' }) };
    const queue = { registerSchedule: jest.fn() };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          WorkflowTriggerService,
          { provide: WorkflowService, useValue: workflows },
          { provide: WorkflowRunnerService, useValue: runner },
          { provide: WorkflowQueueService, useValue: queue },
        ],
      }).compile();
      service = module.get(WorkflowTriggerService);
    });

    it('starts workflows on CRM event', async () => {
      workflows.findActiveByTrigger.mockResolvedValue([{ id: 'w1' }]);
      const results = await service.emitCrmEvent('org-1', 'LEAD_CREATED', { leadId: 'l1' });
      expect(workflows.findActiveByTrigger).toHaveBeenCalledWith(
        'org-1',
        WorkflowTriggerType.CRM_EVENT,
        'LEAD_CREATED',
      );
      expect(runner.startRun).toHaveBeenCalledWith('w1', 'org-1', expect.objectContaining({ leadId: 'l1' }));
      expect(results).toHaveLength(1);
    });

    it('triggers workflow by webhook token', async () => {
      workflows.findByWebhookToken.mockResolvedValue({ id: 'w-hook', organizationId: 'org-1' });
      await service.emitWebhook('token-abc', { foo: 'bar' });
      expect(runner.startRun).toHaveBeenCalledWith(
        'w-hook',
        'org-1',
        expect.objectContaining({ foo: 'bar', event: 'WEBHOOK' }),
      );
    });
  });

  describe('WorkflowRunnerService — execution & retry', () => {
    let service: WorkflowRunnerService;
    const prisma = {
      workflow: { findFirst: jest.fn() },
      workflowExecution: {
        create: jest.fn().mockResolvedValue({ id: 'exec-1' }),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      workflowExecutionLog: { create: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue({ email: 'u@test.io', role: UserRole.USER }) },
      organizationMember: { findFirst: jest.fn().mockResolvedValue({ role: OrganizationRole.OPERATOR }) },
    };
    const executor = {
      execute: jest.fn().mockResolvedValue({ output: { ok: true } }),
    };
    const queue = { enqueueRun: jest.fn(), enqueueRetry: jest.fn(), enqueueDlq: jest.fn() };
    const workflows = { assertOwned: jest.fn() };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          WorkflowRunnerService,
          { provide: PrismaService, useValue: prisma },
          { provide: WorkflowStepExecutorService, useValue: executor },
          { provide: WorkflowQueueService, useValue: queue },
          { provide: WorkflowService, useValue: workflows },
        ],
      }).compile();
      service = module.get(WorkflowRunnerService);
    });

    it('enqueues run for active workflow', async () => {
      prisma.workflow.findFirst.mockResolvedValue({
        id: 'w1',
        organizationId: 'org-1',
        currentVersion: { id: 'v1', steps: [] },
      });
      await service.startRun('w1', 'org-1', { manual: true });
      expect(queue.enqueueRun).toHaveBeenCalledWith(
        expect.objectContaining({ workflowId: 'w1', organizationId: 'org-1' }),
      );
    });

    it('logs each step on successful run', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue({
        id: 'exec-1',
        organizationId: 'org-1',
        triggerData: {},
        workflow: { createdById: 'user-1' },
        version: {
          steps: [
            { id: 's1', stepKey: 'start', stepType: WorkflowStepType.START, configuration: {} },
            { id: 's2', stepKey: 'end', stepType: WorkflowStepType.END, configuration: {} },
          ],
        },
      });

      const result = await service.runExecution('exec-1', 1);
      expect(result.status).toBe(WorkflowExecutionStatus.COMPLETED);
      expect(prisma.workflowExecutionLog.create).toHaveBeenCalledTimes(2);
    });

    it('schedules retry before DLQ on failure', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue({
        id: 'exec-1',
        organizationId: 'org-1',
        workflowId: 'w1',
        triggerData: {},
        workflow: { createdById: 'user-1' },
        version: {
          steps: [{ id: 's1', stepKey: 'tool', stepType: WorkflowStepType.TOOL, configuration: {} }],
        },
      });
      executor.execute.mockRejectedValue(new Error('tool failed'));

      const r1 = await service.runExecution('exec-1', 1);
      expect('retry' in r1 && r1.retry).toBe(true);
      expect(queue.enqueueRetry).toHaveBeenCalled();
    });

    it('moves execution to DLQ after max attempts', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue({
        id: 'exec-1',
        organizationId: 'org-1',
        workflowId: 'w1',
        triggerData: {},
        workflow: { createdById: 'user-1' },
        version: {
          steps: [{ id: 's1', stepKey: 'tool', stepType: WorkflowStepType.TOOL, configuration: {} }],
        },
      });
      executor.execute.mockRejectedValue(new Error('tool failed'));

      const r3 = await service.runExecution('exec-1', 3);
      expect(r3.status).toBe(WorkflowExecutionStatus.DLQ);
      expect(queue.enqueueDlq).toHaveBeenCalled();
    });

    it('scopes execution lookup to tenant', async () => {
      prisma.workflowExecution.findFirst.mockResolvedValue(null);
      await expect(service.getExecution(tenant, 'missing')).rejects.toThrow(NotFoundException);
      expect(prisma.workflowExecution.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'missing', organizationId: 'org-1' } }),
      );
    });
  });

  describe('WorkflowStepExecutorService — condition operators', () => {
    let service: WorkflowStepExecutorService;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [
          WorkflowStepExecutorService,
          { provide: AssistantChatService, useValue: { chat: jest.fn() } },
          { provide: ToolExecutionService, useValue: { execute: jest.fn() } },
          { provide: CrmToolService, useValue: {} },
          { provide: CrmLeadService, useValue: {} },
          { provide: CrmClientService, useValue: {} },
          { provide: CrmTaskService, useValue: {} },
          { provide: CrmNoteService, useValue: {} },
          { provide: MemorySearchService, useValue: {} },
          { provide: MemoryEntryService, useValue: {} },
        ],
      }).compile();
      service = module.get(WorkflowStepExecutorService);
    });

    it('evaluates equals and contains conditions', async () => {
      const eq = await service.execute(tenant, WorkflowStepType.CONDITION, {
        field: 'trigger.event',
        operator: 'equals',
        value: 'LEAD_CREATED',
      }, { trigger: { event: 'LEAD_CREATED' } });
      expect(eq.output.passed).toBe(true);

      const contains = await service.execute(tenant, WorkflowStepType.CONDITION, {
        field: 'trigger.name',
        operator: 'contains',
        value: 'Acme',
      }, { trigger: { name: 'Lead Acme Corp' } });
      expect(contains.output.passed).toBe(true);
    });
  });
});
