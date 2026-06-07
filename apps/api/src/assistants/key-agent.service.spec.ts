import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { KeyAgentService } from './key-agent.service';
import { AgentTemplateService } from './agent-template.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationRole, UserRole, AgentType } from '@prisma/client';

describe('KeyAgentService — tenant isolation', () => {
  let service: KeyAgentService;

  const orgA = 'org-a';
  const orgB = 'org-b';
  const agentInA = {
    id: 'agent-1',
    organizationId: orgA,
    slug: 'test',
    name: 'Test',
  };

  const prisma = {
    keyAgent: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    planLimits: { findUnique: jest.fn().mockResolvedValue({ maxAssistants: 10 }) },
  };

  const templates = {
    findById: jest.fn(),
    incrementInstallCount: jest.fn(),
  };

  const tenantA = {
    userId: 'user-1',
    email: 'a@test.com',
    role: UserRole.USER,
    organizationId: orgA,
    organizationRole: OrganizationRole.OWNER,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeyAgentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AgentTemplateService, useValue: templates },
      ],
    }).compile();
    service = module.get(KeyAgentService);
  });

  it('blocks access to assistant in another organization', async () => {
    prisma.keyAgent.findUnique.mockResolvedValue(agentInA);
    await expect(service.assertOwned('agent-1', orgB)).rejects.toThrow(ForbiddenException);
  });

  it('allows access within same organization', async () => {
    prisma.keyAgent.findUnique.mockResolvedValue(agentInA);
    await expect(service.assertOwned('agent-1', orgA)).resolves.toEqual(agentInA);
  });

  it('throws when assistant not found', async () => {
    prisma.keyAgent.findUnique.mockResolvedValue(null);
    await expect(service.assertOwned('missing', orgA)).rejects.toThrow(NotFoundException);
  });

  it('lists only organization-scoped assistants', async () => {
    prisma.keyAgent.findMany.mockResolvedValue([agentInA]);
    await service.findAll(tenantA, { agentType: AgentType.SALES });
    expect(prisma.keyAgent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: orgA, agentType: AgentType.SALES },
      }),
    );
  });
});
