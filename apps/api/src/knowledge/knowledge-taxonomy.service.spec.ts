import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { KnowledgeTaxonomyService } from './knowledge-taxonomy.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationRole, UserRole } from '@prisma/client';

describe('KnowledgeTaxonomyService — CRUD', () => {
  let service: KnowledgeTaxonomyService;

  const orgA = 'org-a';
  const kbId = 'kb-1';

  const prisma = {
    knowledgeCategory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    knowledgeTopic: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    knowledgeTag: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    knowledgeDocument: { findUnique: jest.fn() },
    knowledgeDocumentTag: { deleteMany: jest.fn(), createMany: jest.fn() },
  };

  const kb = {
    assertOwned: jest.fn().mockResolvedValue({ id: kbId, organizationId: orgA }),
  };

  const tenant = {
    userId: 'u1',
    email: 'a@test.com',
    role: UserRole.USER,
    organizationId: orgA,
    organizationRole: OrganizationRole.OWNER,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeTaxonomyService,
        { provide: PrismaService, useValue: prisma },
        { provide: KnowledgeBaseService, useValue: kb },
      ],
    }).compile();
    service = module.get(KnowledgeTaxonomyService);
  });

  it('creates category scoped to tenant org', async () => {
    prisma.knowledgeCategory.create.mockResolvedValue({ id: 'cat-1', name: 'Docs' });
    await service.createCategory(tenant, {
      knowledgeBaseId: kbId,
      name: 'Docs',
    });
    expect(kb.assertOwned).toHaveBeenCalledWith(kbId, orgA);
    expect(prisma.knowledgeCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: orgA, knowledgeBaseId: kbId }),
      }),
    );
  });

  it('blocks category update from other org', async () => {
    prisma.knowledgeCategory.findUnique.mockResolvedValue({
      id: 'cat-1',
      organizationId: 'other-org',
    });
    await expect(
      service.updateCategory({ ...tenant, organizationId: orgA }, 'cat-1', { name: 'X' }),
    ).rejects.toThrow(ForbiddenException);
  });
});
