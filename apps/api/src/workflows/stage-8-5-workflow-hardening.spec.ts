import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  OrganizationRole,
  UserRole,
  WorkflowStepType,
  WorkflowExecutionStatus,
} from '@prisma/client';
import { WorkflowGraphEngine } from './workflow-graph.engine';
import { WorkflowRunnerService } from './workflow-runner.service';
import { WorkflowStepExecutorService } from './workflow-step-executor.service';
import { WorkflowTemplateService } from './workflow-template.service';
import { WorkflowMetricsService } from './workflow-metrics.service';
import { WorkflowQueueService } from './workflow-queue.service';
import { WorkflowService } from './workflow.service';
import { IntegrationToolService } from '../integrations/integration-tool.service';
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
import { IntegrationAccountService } from '../integrations/integration-account.service';
import { ConversationService } from '../integrations/conversation.service';
import { MessageService } from '../integrations/message.service';
import { TelegramAdapter } from '../integrations/providers/telegram.adapter';
import { MaxAdapter } from '../integrations/providers/max.adapter';
import { EmailAdapter } from '../integrations/providers/email.adapter';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

const tenant: TenantContext = {
  organizationId: 'org-1',
  userId: 'user-1',
  email: 'u@test.io',
  role: UserRole.USER,
  organizationRole: OrganizationRole.OPERATOR,
};

describe('Stage 8.5 — Workflow Hardening', () => {
  describe('WorkflowGraphEngine', () => {
    const engine = new WorkflowGraphEngine();

    it('resolves branch next step key', () => {
      const step = {
        id: 's1',
        stepKey: 'branch',
        stepType: WorkflowStepType.BRANCH,
        configuration: { trueStepKey: 'yes', falseStepKey: 'no' },
        position: 1,
      };
      const next = engine.resolveNextStepKeys(
        step,
        { output: { nextStepKey: 'yes' }, nextStepKeys: ['yes'] },
        { steps: ['start', 'branch', 'yes', 'no', 'end'], edges: [] },
      );
      expect(next).toEqual(['yes']);
    });

    it('supports parallel targets in configuration', () => {
      const step = {
        id: 's2',
        stepKey: 'fork',
        stepType: WorkflowStepType.START,
        configuration: { parallelTargets: ['a', 'b'], joinStepKey: 'merge' },
        position: 0,
      };
      const next = engine.resolveNextStepKeys(step, { output: {} }, { steps: [], edges: [] });
      expect(next).toEqual(['a', 'b', 'merge']);
    });
  });

  describe('WorkflowStepExecutorService — async WAIT', () => {
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

    it('returns asyncWait for waits longer than 30s', async () => {
      const result = await service.execute(tenant, WorkflowStepType.WAIT, { seconds: 45 }, {});
      expect(result.asyncWait).toBe(true);
      expect(result.waitMs).toBe(45000);
    });

    it('sync wait for short delays', async () => {
      const result = await service.execute(tenant, WorkflowStepType.WAIT, { seconds: 1 }, {});
      expect(result.asyncWait).toBeUndefined();
      expect(result.output.mode).toBe('sync');
    });
  });

  describe('WorkflowRunnerService — DLQ recovery', () => {
    let service: WorkflowRunnerService;
    const prisma = {
      workflowExecution: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    const queue = { enqueueRun: jest.fn() };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          WorkflowRunnerService,
          { provide: PrismaService, useValue: prisma },
          { provide: WorkflowStepExecutorService, useValue: { execute: jest.fn() } },
          { provide: WorkflowQueueService, useValue: queue },
          { provide: WorkflowService, useValue: {} },
        ],
      }).compile();
      service = module.get(WorkflowRunnerService);
    });

    it('recovers DLQ execution', async () => {
      prisma.workflowExecution.findFirst.mockResolvedValue({
        id: 'exec-1',
        organizationId: 'org-1',
        workflowId: 'w1',
        status: WorkflowExecutionStatus.DLQ,
      });
      const result = await service.recoverFromDlq(tenant, 'exec-1');
      expect(result.recovered).toBe(true);
      expect(queue.enqueueRun).toHaveBeenCalled();
    });

    it('rejects non-DLQ recovery', async () => {
      prisma.workflowExecution.findFirst.mockResolvedValue({
        id: 'exec-1',
        status: WorkflowExecutionStatus.COMPLETED,
      });
      await expect(service.recoverFromDlq(tenant, 'exec-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('WorkflowTemplateService', () => {
    it('lists template categories', async () => {
      const prisma = {
        workflowTemplateCategory: { findMany: jest.fn().mockResolvedValue([{ id: 'c1' }]) },
        workflowTemplate: { findUnique: jest.fn(), update: jest.fn() },
      };
      const workflows = { createFromTemplate: jest.fn() };
      const module = await Test.createTestingModule({
        providers: [
          WorkflowTemplateService,
          { provide: PrismaService, useValue: prisma },
          { provide: WorkflowService, useValue: workflows },
        ],
      }).compile();
      const service = module.get(WorkflowTemplateService);
      const cats = await service.listCategories();
      expect(cats).toHaveLength(1);
    });
  });

  describe('WorkflowMetricsService', () => {
    it('returns aggregated metrics', async () => {
      const prisma = {
        workflowExecution: { count: jest.fn().mockResolvedValue(10) },
        workflow: { count: jest.fn().mockResolvedValue(2), groupBy: jest.fn().mockResolvedValue([]) },
        workflowTemplate: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const module = await Test.createTestingModule({
        providers: [WorkflowMetricsService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      const service = module.get(WorkflowMetricsService);
      const metrics = await service.getMetrics(tenant);
      expect(metrics.executions.total).toBe(10);
    });
  });

  describe('IntegrationToolService — tool bridge', () => {
    let service: IntegrationToolService;
    const accounts = {
      findOne: jest.fn().mockResolvedValue({ id: 'acc-1', settings: {} }),
      getSecret: jest.fn().mockResolvedValue('token'),
      assertOwned: jest.fn(),
    };
    const conversations = { upsert: jest.fn().mockResolvedValue({ id: 'conv-1' }) };
    const messages = { create: jest.fn().mockResolvedValue({ id: 'msg-1' }) };
    const telegram = { sendMessage: jest.fn().mockResolvedValue({ ok: true }) };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          IntegrationToolService,
          { provide: IntegrationAccountService, useValue: accounts },
          { provide: ConversationService, useValue: conversations },
          { provide: MessageService, useValue: messages },
          { provide: TelegramAdapter, useValue: telegram },
          { provide: MaxAdapter, useValue: { sendMessage: jest.fn() } },
          { provide: EmailAdapter, useValue: { sendMessage: jest.fn() } },
        ],
      }).compile();
      service = module.get(IntegrationToolService);
    });

    it('sends telegram via integration account', async () => {
      const result = await service.executeMessagingTool(
        tenant,
        'telegram',
        { integrationAccountId: 'acc-1', chatId: '123' },
        { message: 'Hello' },
      );
      expect(result.conversationId).toBe('conv-1');
      expect(telegram.sendMessage).toHaveBeenCalled();
    });
  });
});
