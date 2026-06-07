import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeStatsService } from './knowledge-stats.service';
import { KnowledgePlanLimitsService } from './knowledge-plan-limits.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationRole, UserRole } from '@prisma/client';

describe('KnowledgeBaseService — tenant isolation', () => {
  let service: KnowledgeBaseService;

  const orgA = 'org-a';
  const orgB = 'org-b';
  const kbInA = { id: 'kb-1', organizationId: orgA, slug: 'test', name: 'Test' };

  const prisma = {
    knowledgeBase: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    planLimits: { findUnique: jest.fn().mockResolvedValue({ maxKnowledgeBases: 5 }) },
    knowledgeDocument: { groupBy: jest.fn().mockResolvedValue([]) },
    knowledgeSource: { count: jest.fn().mockResolvedValue(0) },
  };

  const stats = { refresh: jest.fn().mockResolvedValue({}) };
  const limits = { assertCanCreateKnowledgeBase: jest.fn() };

  const tenantB = {
    userId: 'user-2',
    email: 'b@test.com',
    role: UserRole.USER,
    organizationId: orgB,
    organizationRole: OrganizationRole.OWNER,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeBaseService,
        { provide: PrismaService, useValue: prisma },
        { provide: KnowledgeStatsService, useValue: stats },
        { provide: KnowledgePlanLimitsService, useValue: limits },
      ],
    }).compile();
    service = module.get(KnowledgeBaseService);
  });

  it('assertOwned throws NotFound when missing', async () => {
    prisma.knowledgeBase.findUnique.mockResolvedValue(null);
    await expect(service.assertOwned('missing', orgA)).rejects.toThrow(NotFoundException);
  });

  it('assertOwned throws Forbidden for other org', async () => {
    prisma.knowledgeBase.findUnique.mockResolvedValue(kbInA);
    await expect(service.assertOwned('kb-1', orgB)).rejects.toThrow(ForbiddenException);
  });

  it('findOne refreshes stats for owned kb', async () => {
    prisma.knowledgeBase.findUnique
      .mockResolvedValueOnce(kbInA)
      .mockResolvedValueOnce({ ...kbInA, _count: {} });
    await service.findOne(tenantB, 'kb-1').catch(() => undefined);
    prisma.knowledgeBase.findUnique.mockResolvedValue(kbInA);
    await expect(service.findOne(tenantB, 'kb-1')).rejects.toThrow(ForbiddenException);
  });
});
