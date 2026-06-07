import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  OrganizationRole,
  UserRole,
  MemoryProfileEntityType,
  MemoryEntryType,
  MemorySearchMode,
} from '@prisma/client';
import { MemoryProfileService } from './memory-profile.service';
import { MemoryEntryService } from './memory-entry.service';
import { MemorySearchService } from './memory-search.service';
import { MemoryPlanLimitsService } from './memory-plan-limits.service';
import { MemoryEmbeddingService } from './memory-embedding.service';
import { EmbeddingClientService } from '../knowledge/embedding/embedding-client.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

const tenant: TenantContext = {
  organizationId: 'org-1',
  userId: 'user-1',
  email: 'u@test.io',
  role: UserRole.USER,
  organizationRole: OrganizationRole.OPERATOR,
};

describe('Stage 7 — Enterprise Memory Platform', () => {
  describe('MemoryProfileService — CRUD & tenant isolation', () => {
    let service: MemoryProfileService;
    const prisma = {
      memoryProfile: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    const limits = { assertCanCreateProfile: jest.fn() };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          MemoryProfileService,
          { provide: PrismaService, useValue: prisma },
          { provide: MemoryPlanLimitsService, useValue: limits },
        ],
      }).compile();
      service = module.get(MemoryProfileService);
    });

    it('lists profiles scoped to organization', async () => {
      prisma.memoryProfile.findMany.mockResolvedValue([]);
      await service.list(tenant);
      expect(prisma.memoryProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1' } }),
      );
    });

    it('rejects cross-tenant profile access', async () => {
      prisma.memoryProfile.findUnique.mockResolvedValue({ id: 'p1', organizationId: 'org-other' });
      await expect(service.assertOwned('p1', 'org-1')).rejects.toThrow(ForbiddenException);
    });

    it('getOrCreate returns existing assistant profile', async () => {
      prisma.memoryProfile.findUnique.mockResolvedValue({ id: 'p1', entityType: 'ASSISTANT' });
      const p = await service.getOrCreate(tenant, {
        entityType: MemoryProfileEntityType.ASSISTANT,
        entityId: 'asst-1',
      });
      expect(p.id).toBe('p1');
      expect(limits.assertCanCreateProfile).not.toHaveBeenCalled();
    });
  });

  describe('MemoryEntryService — create & workflow write', () => {
    let service: MemoryEntryService;
    const prisma = {
      memoryEntry: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
    };
    const profiles = {
      assertOwned: jest.fn(),
      resolveProfile: jest.fn().mockResolvedValue({ id: 'prof-1' }),
      getOrCreate: jest.fn(),
    };
    const limits = { assertCanCreateEntry: jest.fn() };
    const embeddings = { indexEntry: jest.fn(), deleteForEntry: jest.fn() };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          MemoryEntryService,
          { provide: PrismaService, useValue: prisma },
          { provide: MemoryProfileService, useValue: profiles },
          { provide: MemoryPlanLimitsService, useValue: limits },
          { provide: MemoryEmbeddingService, useValue: embeddings },
        ],
      }).compile();
      service = module.get(MemoryEntryService);
    });

    it('creates entry and indexes embedding', async () => {
      prisma.memoryEntry.create.mockResolvedValue({ id: 'e1', content: 'Fact' });
      await service.create(tenant, 'prof-1', { content: 'Client prefers email' });
      expect(limits.assertCanCreateEntry).toHaveBeenCalled();
      expect(prisma.memoryEntry.create).toHaveBeenCalled();
    });

    it('writes memory from workflow config', async () => {
      prisma.memoryEntry.create.mockResolvedValue({ id: 'e2', content: 'From workflow' });
      const result = await service.writeForWorkflow(
        tenant,
        { profileId: 'prof-1', content: 'From workflow', entryType: MemoryEntryType.OBSERVATION },
        { trigger: { event: 'LEAD_CREATED' } },
      );
      expect(result.entryId).toBe('e2');
    });
  });

  describe('MemorySearchService — keyword search', () => {
    let service: MemorySearchService;
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        { entryId: 'e1', content: 'Acme Corp', entryType: 'FACT', importance: 5, score: 0.8, source: null },
      ]),
      memorySearchLog: { create: jest.fn() },
      embeddingProfile: { findFirst: jest.fn(), findUnique: jest.fn() },
      memoryEntry: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const profiles = {
      resolveProfile: jest.fn().mockResolvedValue({ id: 'prof-1' }),
    };
    const memoryEmbed = {
      resolveEmbeddingProfileId: jest.fn().mockResolvedValue(null),
      vectorSearch: jest.fn(),
    };
    const embedClient = { embedText: jest.fn() };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          MemorySearchService,
          { provide: PrismaService, useValue: prisma },
          { provide: MemoryProfileService, useValue: profiles },
          { provide: MemoryEmbeddingService, useValue: memoryEmbed },
          { provide: EmbeddingClientService, useValue: embedClient },
        ],
      }).compile();
      service = module.get(MemorySearchService);
    });

    it('searches with keyword mode and logs query', async () => {
      const result = await service.search(tenant, {
        query: 'Acme',
        profileId: 'prof-1',
        mode: MemorySearchMode.KEYWORD,
      });
      expect(result.hits.length).toBeGreaterThan(0);
      expect(prisma.memorySearchLog.create).toHaveBeenCalled();
    });
  });

  describe('MemoryEmbeddingService — profile resolution', () => {
    let service: MemoryEmbeddingService;
    const prisma = {
      embeddingProfile: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ep-1', dimensions: 3072, isActive: true }),
        findUnique: jest.fn(),
      },
      $executeRaw: jest.fn(),
    };
    const embedClient = { embedText: jest.fn().mockResolvedValue(new Array(3072).fill(0.1)) };

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [
          MemoryEmbeddingService,
          { provide: PrismaService, useValue: prisma },
          { provide: EmbeddingClientService, useValue: embedClient },
        ],
      }).compile();
      service = module.get(MemoryEmbeddingService);
    });

    it('resolves org embedding profile', async () => {
      const id = await service.resolveEmbeddingProfileId('org-1');
      expect(id).toBe('ep-1');
    });
  });
});
