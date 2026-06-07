import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { OrganizationRole, ToolExecutionStatus, ToolProviderType, UserRole } from '@prisma/client';
import { AssistantToolBindingService } from './assistant-tool-binding.service';
import { ToolInstanceService } from './tool-instance.service';
import { ToolExecutionService } from './tool-execution.service';
import { ToolsPlanLimitsService } from './tools-plan-limits.service';
import { PrismaService } from '../prisma/prisma.service';
import { SecretEncryptionService } from '../secrets/secret-encryption.service';
import { ToolCatalogService } from './tool-catalog.service';
import { RetrievalService } from '../knowledge/search/retrieval.service';
import { CrmToolService } from '../crm/crm-tool.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

const tenant: TenantContext = {
  organizationId: 'org-1',
  userId: 'user-1',
  email: 'u@test.io',
  role: UserRole.USER,
  organizationRole: OrganizationRole.OPERATOR,
};

describe('Stage 4 — tool registry platform', () => {
  describe('AssistantToolBindingService — tenant isolation', () => {
    let service: AssistantToolBindingService;
    const prisma = {
      keyAgent: { findUnique: jest.fn() },
      assistantToolBinding: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    const instances = { assertOwned: jest.fn() };

    beforeEach(async () => {
      jest.clearAllMocks();
      prisma.keyAgent.findUnique.mockResolvedValue({ id: 'asst-1', organizationId: 'org-1' });
      instances.assertOwned.mockResolvedValue({ id: 'ti-1', organizationId: 'org-1' });
      const module = await Test.createTestingModule({
        providers: [
          AssistantToolBindingService,
          { provide: PrismaService, useValue: prisma },
          { provide: ToolInstanceService, useValue: instances },
        ],
      }).compile();
      service = module.get(AssistantToolBindingService);
    });

    it('lists bindings scoped to organization', async () => {
      prisma.assistantToolBinding.findMany.mockResolvedValue([]);
      await service.list(tenant, 'asst-1');
      expect(prisma.assistantToolBinding.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { assistantId: 'asst-1', organizationId: 'org-1' },
        }),
      );
    });

    it('rejects assistant from another organization', async () => {
      prisma.keyAgent.findUnique.mockResolvedValue({ id: 'asst-1', organizationId: 'org-other' });
      await expect(service.list(tenant, 'asst-1')).rejects.toThrow(ForbiddenException);
    });

    it('rejects binding from another organization', async () => {
      prisma.assistantToolBinding.findUnique.mockResolvedValue({
        id: 'b1',
        assistantId: 'asst-1',
        organizationId: 'org-other',
      });
      await expect(
        service.update(tenant, 'asst-1', 'b1', { enabled: false }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('ToolsPlanLimitsService', () => {
    let service: ToolsPlanLimitsService;
    const prisma = {
      planLimits: { findUnique: jest.fn() },
      toolInstance: { count: jest.fn() },
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      prisma.planLimits.findUnique.mockResolvedValue({ maxToolInstances: 2 });
      prisma.toolInstance.count.mockResolvedValue(2);
      const module = await Test.createTestingModule({
        providers: [ToolsPlanLimitsService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      service = module.get(ToolsPlanLimitsService);
    });

    it('blocks instance creation over limit', async () => {
      await expect(service.assertCanCreateInstance('org-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('ToolExecutionService — execution logs', () => {
    let service: ToolExecutionService;
    const prisma = {
      toolInstance: { findFirst: jest.fn(), update: jest.fn() },
      toolExecutionLog: { create: jest.fn() },
    };
    const secrets = { getSecret: jest.fn() };
    const crmTools = {
      executeTool: jest.fn().mockResolvedValue({ id: 'lead-1', entity: 'lead', lead: { id: 'lead-1' } }),
      testCrmTool: jest.fn().mockResolvedValue({ ok: true }),
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      prisma.toolInstance.findFirst.mockResolvedValue({
        id: 'ti-1',
        status: 'ACTIVE',
        settings: {},
        secretId: null,
        lastTestedAt: null,
        lastTestStatus: null,
        definition: {
          slug: 'create-lead',
          providerType: ToolProviderType.INTERNAL,
          metadata: { category: 'crm' },
        },
      });
      prisma.toolExecutionLog.create.mockResolvedValue({ id: 'log-1' });
      prisma.toolInstance.update.mockResolvedValue({});

      const module = await Test.createTestingModule({
        providers: [
          ToolExecutionService,
          { provide: PrismaService, useValue: prisma },
          { provide: SecretEncryptionService, useValue: secrets },
          { provide: RetrievalService, useValue: { searchWithMode: jest.fn() } },
          { provide: CrmToolService, useValue: crmTools },
        ],
      }).compile();
      service = module.get(ToolExecutionService);
    });

    it('executes CRM tool via CrmToolService and writes log', async () => {
      const result = await service.execute(tenant, 'ti-1', { name: 'Lead' }, 'asst-1');
      expect(result.status).toBe(ToolExecutionStatus.SUCCESS);
      expect(crmTools.executeTool).toHaveBeenCalled();
      expect(result.output).toMatchObject({ entity: 'lead' });
      expect(prisma.toolExecutionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assistantId: 'asst-1',
            toolInstanceId: 'ti-1',
            status: ToolExecutionStatus.SUCCESS,
          }),
        }),
      );
    });

    it('test connection returns ok for internal tool', async () => {
      prisma.toolInstance.findFirst.mockResolvedValue({
        id: 'ti-1',
        status: 'ACTIVE',
        settings: {},
        secretId: 'sec-1',
        lastTestedAt: null,
        lastTestStatus: null,
        definition: {
          slug: 'telegram',
          providerType: ToolProviderType.INTERNAL,
          metadata: { requiresSecret: true },
        },
      });
      secrets.getSecret.mockResolvedValue('bot-token');
      const result = await service.testConnection(tenant, 'ti-1');
      expect(result.status).toBe(ToolExecutionStatus.SUCCESS);
      expect(secrets.getSecret).toHaveBeenCalledWith('sec-1', 'org-1');
    });
  });

  describe('ToolInstanceService — secret handling', () => {
    let service: ToolInstanceService;
    const prisma = {
      toolInstance: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      encryptedSecret: { update: jest.fn() },
    };
    const secrets = { storeSecret: jest.fn(), updateSecret: jest.fn(), deleteSecret: jest.fn() };
    const limits = { assertCanCreateInstance: jest.fn() };
    const catalog = { getBySlug: jest.fn() };

    beforeEach(async () => {
      jest.clearAllMocks();
      limits.assertCanCreateInstance.mockResolvedValue(undefined);
      catalog.getBySlug.mockResolvedValue({ id: 'def-1', slug: 'webhook' });
      secrets.storeSecret.mockResolvedValue({ id: 'sec-1' });
      prisma.toolInstance.create.mockResolvedValue({ id: 'ti-1', definition: { slug: 'webhook' } });
      prisma.encryptedSecret.update.mockResolvedValue({});

      const module = await Test.createTestingModule({
        providers: [
          ToolInstanceService,
          { provide: PrismaService, useValue: prisma },
          { provide: SecretEncryptionService, useValue: secrets },
          { provide: ToolsPlanLimitsService, useValue: limits },
          { provide: ToolCatalogService, useValue: catalog },
        ],
      }).compile();
      service = module.get(ToolInstanceService);
    });

    it('stores encrypted secret on create', async () => {
      await service.create(tenant, {
        toolDefinitionSlug: 'webhook',
        name: 'My Webhook',
        secret: 'top-secret',
      });
      expect(secrets.storeSecret).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          plainValue: 'top-secret',
        }),
      );
    });

    it('assertOwned rejects other org', async () => {
      prisma.toolInstance.findUnique.mockResolvedValue({
        id: 'ti-1',
        organizationId: 'org-other',
      });
      await expect(service.assertOwned('ti-1', 'org-1')).rejects.toThrow(ForbiddenException);
    });
  });
});
