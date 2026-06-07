import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SitemapExpansionService } from './domain/sitemap-expansion.service';
import { DomainDiscoveryService } from './domain/domain-discovery.service';
import { DomainProfileService } from './domain-profile.service';
import { KnowledgePlanLimitsService } from './knowledge-plan-limits.service';
import { KnowledgeJobService } from './jobs/knowledge-job.service';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { ParserMode } from '@prisma/client';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Stage 2B — ingestion pipeline units', () => {
  describe('SitemapExpansionService', () => {
    let service: SitemapExpansionService;

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [SitemapExpansionService],
      }).compile();
      service = module.get(SitemapExpansionService);
    });

    it('parses sitemap.xml loc entries', async () => {
      mockedAxios.get.mockResolvedValue({
        data: `<?xml version="1.0"?><urlset>
          <url><loc>https://site.ru/page1</loc></url>
          <url><loc>https://site.ru/page2</loc></url>
        </urlset>`,
      });

      const urls = await service.expandSitemap('https://site.ru/sitemap.xml', 100);
      expect(urls).toEqual(['https://site.ru/page1', 'https://site.ru/page2']);
    });

    it('follows sitemap-index.xml', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: `<sitemapindex><sitemap><loc>https://site.ru/sitemap-1.xml</loc></sitemap></sitemapindex>`,
        })
        .mockResolvedValueOnce({
          data: `<urlset><url><loc>https://site.ru/a</loc></url></urlset>`,
        });

      const urls = await service.expandSitemap('https://site.ru/sitemap-index.xml', 50);
      expect(urls).toContain('https://site.ru/a');
    });

    it('respects maxUrls limit', async () => {
      const locs = Array.from({ length: 20 }, (_, i) => `<url><loc>https://site.ru/p${i}</loc></url>`).join('');
      mockedAxios.get.mockResolvedValue({ data: `<urlset>${locs}</urlset>` });

      const urls = await service.expandSitemap('https://site.ru/sitemap.xml', 5);
      expect(urls.length).toBeLessThanOrEqual(5);
    });
  });

  describe('DomainDiscoveryService', () => {
    let service: DomainDiscoveryService;

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [DomainDiscoveryService],
      }).compile();
      service = module.get(DomainDiscoveryService);
    });

    it('parses robots.txt sitemap and disallow', async () => {
      mockedAxios.get.mockResolvedValue({
        data: `User-agent: *\nDisallow: /private\nSitemap: https://consultant.ru/sitemap.xml`,
      });

      const robots = await service.fetchRobots('https://consultant.ru');
      expect(robots.sitemapUrls).toContain('https://consultant.ru/sitemap.xml');
      expect(robots.allowed).toBe(true);
    });

    it('discovers same-host links with maxPages', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: 'User-agent: *\nAllow: /' })
        .mockResolvedValueOnce({
          data: '<html><a href="/page2">x</a><a href="https://other.com/x">y</a></html>',
        })
        .mockResolvedValueOnce({ data: '<html>leaf</html>' });

      const urls = await service.discoverUrls('https://example.com/', { maxDepth: 1, maxPages: 5 });
      expect(urls[0]).toBe('https://example.com/');
      expect(urls.some((u) => u.includes('/page2'))).toBe(true);
    });
  });

  describe('DomainProfileService — parser mode selection', () => {
    let service: DomainProfileService;
    const prisma = {
      domainProfile: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [DomainProfileService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      service = module.get(DomainProfileService);
    });

    it('maps consultant.ru → LEGAL_DEEP', async () => {
      prisma.domainProfile.findUnique.mockResolvedValue(null);
      const mode = await service.resolveParserMode('consultant.ru');
      expect(mode).toBe(ParserMode.LEGAL_DEEP);
    });

    it('maps sudrf.ru → LEGAL_FAST', async () => {
      prisma.domainProfile.findUnique.mockResolvedValue(null);
      const mode = await service.resolveParserMode('sudrf.ru');
      expect(mode).toBe(ParserMode.LEGAL_FAST);
    });

    it('maps ozon.ru → MARKETPLACE_HARD', async () => {
      prisma.domainProfile.findUnique.mockResolvedValue(null);
      const mode = await service.resolveParserMode('ozon.ru');
      expect(mode).toBe(ParserMode.MARKETPLACE_HARD);
    });

    it('respects manual override', async () => {
      const mode = await service.resolveParserMode('consultant.ru', ParserMode.STANDARD);
      expect(mode).toBe(ParserMode.STANDARD);
    });
  });

  describe('KnowledgePlanLimitsService', () => {
    let service: KnowledgePlanLimitsService;
    const prisma = {
      planLimits: { findUnique: jest.fn() },
      knowledgeBase: { count: jest.fn() },
      knowledgeDocument: { count: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      knowledgeSource: { count: jest.fn() },
      knowledgeJob: { count: jest.fn() },
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      prisma.planLimits.findUnique.mockResolvedValue({
        maxKnowledgeBases: 2,
        maxDocuments: 10,
        maxSources: 5,
        maxJobs: 3,
        maxStorageMb: 100,
        maxUrlsPerSitemap: 100,
      });
      const module = await Test.createTestingModule({
        providers: [KnowledgePlanLimitsService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      service = module.get(KnowledgePlanLimitsService);
    });

    it('blocks KB creation over limit', async () => {
      prisma.knowledgeBase.count.mockResolvedValue(2);
      await expect(service.assertCanCreateKnowledgeBase('org-1')).rejects.toThrow(BadRequestException);
    });

    it('blocks job creation when active jobs at limit', async () => {
      prisma.knowledgeJob.count.mockResolvedValue(3);
      await expect(service.assertCanCreateJob('org-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('KnowledgeJobService — tenant isolation', () => {
    let service: KnowledgeJobService;
    const prisma = {
      knowledgeJob: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    const kb = { assertOwned: jest.fn() };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          KnowledgeJobService,
          { provide: PrismaService, useValue: prisma },
          { provide: KnowledgeBaseService, useValue: kb },
        ],
      }).compile();
      service = module.get(KnowledgeJobService);
    });

    it('rejects cross-tenant job access', async () => {
      prisma.knowledgeJob.findUnique.mockResolvedValue({
        id: 'job-1',
        organizationId: 'org-a',
        knowledgeBase: {},
        knowledgeSource: null,
        knowledgeDocument: null,
      });

      await expect(service.assertOwned('job-1', 'org-b')).rejects.toThrow(ForbiddenException);
    });

    it('lists jobs scoped to tenant', async () => {
      prisma.knowledgeJob.findMany.mockResolvedValue([]);
      await service.findAll(
        { organizationId: 'org-a' } as never,
        { knowledgeBaseId: 'kb-1' },
      );
      expect(prisma.knowledgeJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-a', knowledgeBaseId: 'kb-1' },
        }),
      );
    });
  });
});

describe('ZipExtractionService — file filtering', () => {
  it('extracts supported extensions from buffer', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addFile('docs/readme.txt', Buffer.from('hello world text content here'));
    zip.addFile('nested/sub/doc.pdf', Buffer.from('%PDF'));
    zip.addFile('ignore.exe', Buffer.from('bad'));

    const { ZipExtractionService } = require('./domain/zip-extraction.service');
    const svc = new ZipExtractionService({} as never, {} as never);
    const extracted = svc.extract(zip.toBuffer());

    expect(extracted.map((f: { path: string }) => f.path)).toEqual(
      expect.arrayContaining(['docs/readme.txt', 'nested/sub/doc.pdf']),
    );
    expect(extracted.find((f: { path: string }) => f.path.endsWith('.exe'))).toBeUndefined();
  });
});
