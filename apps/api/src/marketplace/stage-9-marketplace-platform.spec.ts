import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  MarketplacePackageStatus,
  MarketplacePackageType,
  MarketplaceVisibility,
  OrganizationRole,
  UserRole,
  WorkflowTriggerType,
  WorkflowStepType,
} from '@prisma/client';
import { MarketplacePackageService } from './marketplace-package.service';
import { MarketplaceInstallService } from './marketplace-install.service';
import { MarketplaceReviewService } from './marketplace-review.service';
import { MarketplaceCloneService } from './marketplace-clone.service';
import { MarketplaceFeaturedService } from './marketplace-featured.service';
import { PrismaService } from '../prisma/prisma.service';
import { ToolCatalogService } from '../tools/tool-catalog.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { canViewPackage, marketplaceBrowseWhere } from './marketplace-visibility.util';

const tenantA: TenantContext = {
  organizationId: 'org-a',
  userId: 'user-a',
  email: 'a@test.io',
  role: UserRole.USER,
  organizationRole: OrganizationRole.OWNER,
};

const tenantB: TenantContext = {
  organizationId: 'org-b',
  userId: 'user-b',
  email: 'b@test.io',
  role: UserRole.USER,
  organizationRole: OrganizationRole.OWNER,
};

describe('Stage 9 — Marketplace Platform', () => {
  describe('Visibility utilities — tenant isolation', () => {
    it('PUBLIC published packages visible to any org', () => {
      expect(
        canViewPackage(
          {
            organizationId: 'org-x',
            visibility: MarketplaceVisibility.PUBLIC,
            status: MarketplacePackageStatus.PUBLISHED,
          },
          'org-a',
        ),
      ).toBe(true);
    });

    it('PRIVATE packages visible only to author org', () => {
      const pkg = {
        organizationId: 'org-a',
        visibility: MarketplaceVisibility.PRIVATE,
        status: MarketplacePackageStatus.PUBLISHED,
      };
      expect(canViewPackage(pkg, 'org-a')).toBe(true);
      expect(canViewPackage(pkg, 'org-b')).toBe(false);
    });

    it('browse filter includes PUBLIC and own org packages', () => {
      const where = marketplaceBrowseWhere('org-a');
      expect(where).toMatchObject({
        status: MarketplacePackageStatus.PUBLISHED,
        OR: expect.arrayContaining([
          { visibility: MarketplaceVisibility.PUBLIC },
          expect.objectContaining({ organizationId: 'org-a' }),
        ]),
      });
    });
  });

  describe('MarketplacePackageService — publish & versioning', () => {
    let service: MarketplacePackageService;
    const prisma = {
      marketplacePackage: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      marketplaceVersion: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [MarketplacePackageService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      service = module.get(MarketplacePackageService);
    });

    it('creates draft package with initial version manifest', async () => {
      prisma.marketplacePackage.findUnique.mockResolvedValue(null);
      prisma.marketplacePackage.create.mockResolvedValue({ id: 'pkg-1', slug: 'sales-bot' });
      prisma.marketplaceVersion.create.mockResolvedValue({ id: 'ver-1' });

      await service.create(tenantA, {
        name: 'Sales Bot',
        type: MarketplacePackageType.ASSISTANT,
        manifest: {
          type: MarketplacePackageType.ASSISTANT,
          assistant: { name: 'Sales Bot', systemPrompt: 'You sell things' },
        },
      });

      expect(prisma.marketplacePackage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-a',
            status: MarketplacePackageStatus.DRAFT,
          }),
        }),
      );
      expect(prisma.marketplaceVersion.create).toHaveBeenCalled();
    });

    it('rejects invalid assistant manifest', async () => {
      await expect(
        service.create(tenantA, {
          name: 'Bad',
          type: MarketplacePackageType.ASSISTANT,
          manifest: { type: MarketplacePackageType.ASSISTANT },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('publishes semver version 1.1.0', async () => {
      prisma.marketplacePackage.findUnique.mockResolvedValue({
        id: 'pkg-1',
        organizationId: 'org-a',
        type: MarketplacePackageType.WORKFLOW,
      });
      prisma.marketplaceVersion.findUnique.mockResolvedValue(null);
      prisma.marketplaceVersion.create.mockResolvedValue({ id: 'ver-2', version: '1.1.0' });
      prisma.marketplacePackage.update.mockResolvedValue({ id: 'pkg-1', version: '1.1.0' });

      await service.publishVersion(tenantA, 'pkg-1', {
        version: '1.1.0',
        changelog: 'Added CRM step',
        manifest: {
          type: MarketplacePackageType.WORKFLOW,
          workflow: {
            name: 'Lead Flow',
            triggerType: WorkflowTriggerType.CRM_EVENT,
            triggerConfig: { event: 'LEAD_CREATED' },
            steps: [
              { stepKey: 'start', stepType: WorkflowStepType.START, position: 0, configuration: {} },
              { stepKey: 'end', stepType: WorkflowStepType.END, position: 1, configuration: {} },
            ],
          },
        },
      });

      expect(prisma.marketplaceVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: '1.1.0', publishedAt: expect.any(Date) }),
        }),
      );
    });

    it('blocks cross-tenant package update', async () => {
      prisma.marketplacePackage.findUnique.mockResolvedValue({
        id: 'pkg-1',
        organizationId: 'org-other',
      });
      await expect(service.update(tenantA, 'pkg-1', { name: 'Hack' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('MarketplaceCloneService — clone validation', () => {
    let service: MarketplaceCloneService;
    const prisma = {
      keyAgent: { create: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
      agentVariable: { createMany: jest.fn() },
      workflow: { create: jest.fn(), update: jest.fn() },
      workflowVersion: { create: jest.fn() },
      workflowStep: { createMany: jest.fn() },
      toolInstance: { create: jest.fn() },
      knowledgeBase: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
    };
    const catalog = { getBySlug: jest.fn().mockResolvedValue({ id: 'def-1' }) };

    beforeEach(async () => {
      jest.clearAllMocks();
      prisma.keyAgent.create.mockResolvedValue({ id: 'agent-clone-1' });
      prisma.workflow.create.mockResolvedValue({ id: 'wf-clone-1' });
      prisma.workflowVersion.create.mockResolvedValue({ id: 'wfv-1' });
      prisma.toolInstance.create.mockResolvedValue({ id: 'tool-clone-1' });
      prisma.knowledgeBase.create.mockResolvedValue({ id: 'kb-clone-1' });

      const module = await Test.createTestingModule({
        providers: [
          MarketplaceCloneService,
          { provide: PrismaService, useValue: prisma },
          { provide: ToolCatalogService, useValue: catalog },
        ],
      }).compile();
      service = module.get(MarketplaceCloneService);
    });

    it('clones assistant without templateId (no cross-tenant ref)', async () => {
      const cloned = await service.cloneManifest(tenantB, {
        type: MarketplacePackageType.ASSISTANT,
        assistant: { name: 'Bot', systemPrompt: 'Hello' },
      });
      expect(cloned.assistantId).toBe('agent-clone-1');
      expect(prisma.keyAgent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-b',
            templateId: null,
          }),
        }),
      );
    });

    it('validates clone result', () => {
      expect(() =>
        service.validateCloneResult(
          { type: MarketplacePackageType.ASSISTANT, assistant: { name: 'X', systemPrompt: 'Y' } },
          {},
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('MarketplaceInstallService — install pipeline', () => {
    let service: MarketplaceInstallService;
    const prisma = {
      marketplacePackage: { findUnique: jest.fn(), update: jest.fn() },
      marketplaceVersion: { findUnique: jest.fn(), findFirst: jest.fn() },
      marketplaceInstall: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    const clone = {
      cloneManifest: jest.fn(),
      validateCloneResult: jest.fn(),
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          MarketplaceInstallService,
          { provide: PrismaService, useValue: prisma },
          { provide: MarketplaceCloneService, useValue: clone },
        ],
      }).compile();
      service = module.get(MarketplaceInstallService);
    });

    it('installs published PUBLIC package via clone', async () => {
      prisma.marketplacePackage.findUnique.mockResolvedValue({
        id: 'pkg-1',
        status: MarketplacePackageStatus.PUBLISHED,
        visibility: MarketplaceVisibility.PUBLIC,
        organizationId: 'org-x',
        type: MarketplacePackageType.ASSISTANT,
      });
      prisma.marketplaceVersion.findFirst.mockResolvedValue({
        id: 'ver-1',
        manifest: { assistant: { name: 'Bot', systemPrompt: 'Hi' } },
      });
      prisma.marketplaceInstall.findFirst.mockResolvedValue(null);
      prisma.marketplaceInstall.create.mockResolvedValue({ id: 'inst-1' });
      clone.cloneManifest.mockResolvedValue({ assistantId: 'local-agent' });
      prisma.marketplaceInstall.update.mockResolvedValue({
        id: 'inst-1',
        clonedEntities: { assistantId: 'local-agent' },
      });

      const result = await service.install(tenantB, { packageId: 'pkg-1' });
      expect(clone.cloneManifest).toHaveBeenCalled();
      expect(result.clonedEntities).toEqual({ assistantId: 'local-agent' });
      expect(prisma.marketplacePackage.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { installs: { increment: 1 } } }),
      );
    });

    it('rejects install of inaccessible PRIVATE package', async () => {
      prisma.marketplacePackage.findUnique.mockResolvedValue({
        id: 'pkg-1',
        status: MarketplacePackageStatus.PUBLISHED,
        visibility: MarketplaceVisibility.PRIVATE,
        organizationId: 'org-x',
      });
      await expect(service.install(tenantB, { packageId: 'pkg-1' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('MarketplaceReviewService — reviews', () => {
    let service: MarketplaceReviewService;
    const prisma = {
      marketplacePackage: { findUnique: jest.fn(), update: jest.fn() },
      marketplaceReview: { upsert: jest.fn(), aggregate: jest.fn() },
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [MarketplaceReviewService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      service = module.get(MarketplaceReviewService);
    });

    it('creates review and updates rating aggregate', async () => {
      prisma.marketplacePackage.findUnique.mockResolvedValue({
        id: 'pkg-1',
        organizationId: 'org-x',
        visibility: MarketplaceVisibility.PUBLIC,
        status: MarketplacePackageStatus.PUBLISHED,
      });
      prisma.marketplaceReview.upsert.mockResolvedValue({ id: 'rev-1', rating: 5 });
      prisma.marketplaceReview.aggregate.mockResolvedValue({ _avg: { rating: 5 }, _count: { rating: 1 } });

      await service.create(tenantB, { packageId: 'pkg-1', rating: 5, comment: 'Great' });
      expect(prisma.marketplacePackage.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { rating: 5, ratingCount: 1 } }),
      );
    });

    it('blocks review of own package', async () => {
      prisma.marketplacePackage.findUnique.mockResolvedValue({
        id: 'pkg-1',
        organizationId: 'org-a',
        visibility: MarketplaceVisibility.PUBLIC,
        status: MarketplacePackageStatus.PUBLISHED,
      });
      await expect(
        service.create(tenantA, { packageId: 'pkg-1', rating: 5 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('MarketplaceFeaturedService — analytics lists', () => {
    it('returns featured sections', async () => {
      const prisma = {
        marketplacePackage: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const module = await Test.createTestingModule({
        providers: [MarketplaceFeaturedService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      const service = module.get(MarketplaceFeaturedService);
      const result = await service.getFeatured('org-a', 5);
      expect(result).toHaveProperty('featured');
      expect(result).toHaveProperty('mostInstalled');
      expect(prisma.marketplacePackage.findMany).toHaveBeenCalledTimes(5);
    });
  });
});
