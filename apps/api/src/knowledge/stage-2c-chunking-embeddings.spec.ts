import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ChunkStrategyService } from './chunking/chunk-strategy.service';
import { SearchService } from './search/search.service';
import { KnowledgePlanLimitsService } from './knowledge-plan-limits.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChunkStrategy } from '@prisma/client';

describe('Stage 2C — chunking & embeddings', () => {
  describe('ChunkStrategyService', () => {
    let service: ChunkStrategyService;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [ChunkStrategyService],
      }).compile();
      service = module.get(ChunkStrategyService);
    });

    it('splits FIXED with overlap', () => {
      const text = 'a'.repeat(2500);
      const chunks = service.split(text, {
        chunkStrategy: ChunkStrategy.FIXED,
        chunkSize: 1000,
        chunkOverlap: 200,
        minChunkSize: 100,
        maxChunkSize: 4000,
      });
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].charCount).toBe(1000);
    });

    it('splits PARAGRAPH by blank lines', () => {
      const text = 'First paragraph with enough characters to pass minimum size requirement here.\n\nSecond paragraph also long enough to be kept in the output set.';
      const chunks = service.split(text, {
        chunkStrategy: ChunkStrategy.PARAGRAPH,
        chunkSize: 1000,
        chunkOverlap: 0,
        minChunkSize: 50,
        maxChunkSize: 4000,
      });
      expect(chunks.length).toBe(2);
    });

    it('splits LEGAL_ARTICLE by article marker', () => {
      const text =
        'Статья 1. Some legal text that is long enough for chunk minimum size validation.\n\nСтатья 2. Another article with sufficient length for the quality gate.';
      const chunks = service.split(text, {
        chunkStrategy: ChunkStrategy.LEGAL_ARTICLE,
        chunkSize: 1000,
        chunkOverlap: 0,
        minChunkSize: 40,
        maxChunkSize: 4000,
      });
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it('splits MARKDOWN by headers', () => {
      const text = '# Title\n\nIntro paragraph with enough characters to pass minimum.\n\n## Section\n\nBody text with enough characters to pass minimum size.';
      const chunks = service.split(text, {
        chunkStrategy: ChunkStrategy.MARKDOWN,
        chunkSize: 1000,
        chunkOverlap: 0,
        minChunkSize: 30,
        maxChunkSize: 4000,
      });
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('SearchService.mergeRrf', () => {
    let service: SearchService;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [SearchService, { provide: PrismaService, useValue: {} }],
      }).compile();
      service = module.get(SearchService);
    });

    it('merges ranked lists with RRF', () => {
      const a = [{ chunkId: 'c1', score: 0.9, documentId: 'd1', content: 'a' }];
      const b = [{ chunkId: 'c1', score: 0.8, documentId: 'd1', content: 'a' }, { chunkId: 'c2', score: 0.7, documentId: 'd1', content: 'b' }];
      const merged = service.mergeRrf([a, b]);
      expect(merged[0].chunkId).toBe('c1');
      expect(merged.some((m) => m.chunkId === 'c2')).toBe(true);
    });
  });

  describe('KnowledgePlanLimitsService — maxChunks', () => {
    let service: KnowledgePlanLimitsService;
    const prisma = {
      planLimits: { findUnique: jest.fn() },
      knowledgeChunk: { count: jest.fn() },
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      prisma.planLimits.findUnique.mockResolvedValue({ maxChunks: 100 });
      prisma.knowledgeChunk.count.mockResolvedValue(95);
      const module = await Test.createTestingModule({
        providers: [KnowledgePlanLimitsService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      service = module.get(KnowledgePlanLimitsService);
    });

    it('blocks chunk creation over limit', async () => {
      await expect(service.assertCanCreateChunks('org-1', 10)).rejects.toThrow(BadRequestException);
    });

    it('allows chunk creation within limit', async () => {
      await expect(service.assertCanCreateChunks('org-1', 4)).resolves.toBeUndefined();
    });
  });
});
