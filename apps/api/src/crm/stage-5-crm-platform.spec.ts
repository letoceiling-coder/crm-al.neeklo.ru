import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationRole, CrmEntityType, CrmActivityAction, UserRole } from '@prisma/client';
import { CrmClientService } from './crm-client.service';
import { CrmLeadService } from './crm-lead.service';
import { CrmToolService } from './crm-tool.service';
import { CrmWorkspaceService } from './crm-workspace.service';
import { CrmActivityService } from './crm-activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

import { CrmTaskService } from './crm-task.service';
import { CrmNoteService } from './crm-note.service';

const tenant: TenantContext = {
  organizationId: 'org-1',
  userId: 'user-1',
  email: 'u@test.io',
  role: UserRole.USER,
  organizationRole: OrganizationRole.OPERATOR,
};

describe('Stage 5 — internal CRM platform', () => {
  describe('CrmClientService — tenant isolation', () => {
    let service: CrmClientService;
    const prisma = {
      crmClient: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    };
    const workspace = { ensureWorkspace: jest.fn().mockResolvedValue({ id: 'ws-1' }) };
    const activities = { log: jest.fn(), listTimeline: jest.fn().mockResolvedValue([]) };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          CrmClientService,
          { provide: PrismaService, useValue: prisma },
          { provide: CrmWorkspaceService, useValue: workspace },
          { provide: CrmActivityService, useValue: activities },
        ],
      }).compile();
      service = module.get(CrmClientService);
    });

    it('rejects client from another organization', async () => {
      prisma.crmClient.findUnique.mockResolvedValue({ id: 'c1', organizationId: 'org-other' });
      await expect(service.assertOwned('c1', 'org-1')).rejects.toThrow(ForbiddenException);
    });

    it('lists clients scoped to organization', async () => {
      prisma.crmClient.findMany.mockResolvedValue([]);
      await service.list(tenant);
      expect(prisma.crmClient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1' } }),
      );
    });
  });

  describe('CrmLeadService — pipeline', () => {
    let service: CrmLeadService;
    const prisma = {
      crmLead: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'lead-1', name: 'Test', status: 'NEW' }),
      },
    };
    const workspace = { ensureWorkspace: jest.fn().mockResolvedValue({ id: 'ws-1' }) };
    const activities = { log: jest.fn() };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          CrmLeadService,
          { provide: PrismaService, useValue: prisma },
          { provide: CrmWorkspaceService, useValue: workspace },
          { provide: CrmActivityService, useValue: activities },
        ],
      }).compile();
      service = module.get(CrmLeadService);
    });

    it('creates lead with NEW pipeline stage and logs activity', async () => {
      await service.create(tenant, { name: 'Lead A' });
      expect(prisma.crmLead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', workspaceId: 'ws-1', name: 'Lead A' }),
        }),
      );
      expect(activities.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: CrmEntityType.LEAD,
          action: CrmActivityAction.CREATED,
        }),
      );
    });
  });

  describe('CrmToolService — tool integration', () => {
    let service: CrmToolService;
    const leads = { create: jest.fn().mockResolvedValue({ id: 'lead-1', name: 'From Tool' }) };
    const clients = { create: jest.fn().mockResolvedValue({ id: 'client-1', name: 'From Tool' }) };
    const tasks = { create: jest.fn().mockResolvedValue({ id: 'task-1', title: 'Task' }) };
    const notes = { create: jest.fn().mockResolvedValue({ id: 'note-1', content: 'Note' }) };
    const activities = { log: jest.fn() };
    const workspace = { ensureWorkspace: jest.fn().mockResolvedValue({ id: 'ws-1' }) };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          CrmToolService,
          { provide: CrmLeadService, useValue: leads },
          { provide: CrmClientService, useValue: clients },
          { provide: CrmTaskService, useValue: tasks },
          { provide: CrmNoteService, useValue: notes },
          { provide: CrmActivityService, useValue: activities },
          { provide: CrmWorkspaceService, useValue: workspace },
        ],
      }).compile();
      service = module.get(CrmToolService);
    });

    it('create-lead tool creates real lead', async () => {
      const result = await service.executeTool(tenant, 'create-lead', { name: 'Tool Lead' }, 'asst-1');
      expect(leads.create).toHaveBeenCalled();
      expect(result.entity).toBe('lead');
      expect(result.id).toBe('lead-1');
    });

    it('create-client tool creates real client', async () => {
      const result = await service.executeTool(tenant, 'create-client', { name: 'Tool Client' });
      expect(clients.create).toHaveBeenCalled();
      expect(result.entity).toBe('client');
    });
  });
});
