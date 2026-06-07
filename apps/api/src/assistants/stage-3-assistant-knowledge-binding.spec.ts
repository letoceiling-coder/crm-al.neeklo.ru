import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AssistantSearchMode, OrganizationRole, UserRole } from '@prisma/client';
import { AssistantKnowledgeBindingService } from './assistant-knowledge-binding.service';
import { AssistantContextService } from './assistant-context.service';
import { AssistantChatService } from './assistant-chat.service';
import { RetrievalService } from '../knowledge/search/retrieval.service';
import { SearchService } from '../knowledge/search/search.service';
import { EmbeddingStoreService } from '../knowledge/embedding/embedding-store.service';
import { EmbeddingClientService } from '../knowledge/embedding/embedding-client.service';
import { PrismaService } from '../prisma/prisma.service';
import { KeyAgentService } from './key-agent.service';
import { KnowledgeBaseService } from '../knowledge/knowledge-base.service';
import { OpenRouterService } from '../openrouter/openrouter.service';
import { AgentVariableService } from './agent-variable.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

const tenant: TenantContext = {
  organizationId: 'org-1',
  userId: 'user-1',
  email: 'u@test.io',
  role: UserRole.USER,
  organizationRole: OrganizationRole.OPERATOR,
};
const assistantId = 'asst-1';

describe('Stage 3 — assistant knowledge binding + retrieval', () => {
  describe('AssistantKnowledgeBindingService — tenant isolation', () => {
    let service: AssistantKnowledgeBindingService;
    const prisma = {
      assistantKnowledgeBinding: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    const keyAgents = { assertOwned: jest.fn() };
    const kb = { assertOwned: jest.fn() };

    beforeEach(async () => {
      jest.clearAllMocks();
      keyAgents.assertOwned.mockResolvedValue(undefined);
      const module = await Test.createTestingModule({
        providers: [
          AssistantKnowledgeBindingService,
          { provide: PrismaService, useValue: prisma },
          { provide: KeyAgentService, useValue: keyAgents },
          { provide: KnowledgeBaseService, useValue: kb },
        ],
      }).compile();
      service = module.get(AssistantKnowledgeBindingService);
    });

    it('lists bindings scoped to organization', async () => {
      prisma.assistantKnowledgeBinding.findMany.mockResolvedValue([]);
      await service.list(tenant, assistantId);
      expect(keyAgents.assertOwned).toHaveBeenCalledWith(assistantId, 'org-1');
      expect(prisma.assistantKnowledgeBinding.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { assistantId, organizationId: 'org-1' },
        }),
      );
    });

    it('rejects binding from another organization', async () => {
      prisma.assistantKnowledgeBinding.findUnique.mockResolvedValue({
        id: 'b1',
        assistantId,
        organizationId: 'org-other',
      });
      await expect(
        service.update(tenant, assistantId, 'b1', { enabled: false }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws when binding not found', async () => {
      prisma.assistantKnowledgeBinding.findUnique.mockResolvedValue(null);
      await expect(service.remove(tenant, assistantId, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('upsert validates KB ownership', async () => {
      kb.assertOwned.mockResolvedValue(undefined);
      prisma.assistantKnowledgeBinding.upsert.mockResolvedValue({ id: 'b1' });
      await service.upsert(tenant, assistantId, { knowledgeBaseId: 'kb-1' });
      expect(kb.assertOwned).toHaveBeenCalledWith('kb-1', 'org-1');
    });
  });

  describe('RetrievalService.searchWithMode', () => {
    let service: RetrievalService;
    const search = { searchByKeyword: jest.fn(), searchByVector: jest.fn() };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          RetrievalService,
          { provide: PrismaService, useValue: {} },
          { provide: KnowledgeBaseService, useValue: { assertOwned: jest.fn() } },
          { provide: SearchService, useValue: search },
          { provide: EmbeddingStoreService, useValue: {} },
          { provide: EmbeddingClientService, useValue: {} },
        ],
      }).compile();
      service = module.get(RetrievalService);
    });

    it('routes KEYWORD mode to searchByKeyword', async () => {
      const spy = jest.spyOn(service, 'searchByKeyword').mockResolvedValue([]);
      await service.searchWithMode(tenant, 'kb-1', 'query', AssistantSearchMode.KEYWORD, 5);
      expect(spy).toHaveBeenCalled();
    });

    it('routes VECTOR mode to searchByVector', async () => {
      const spy = jest.spyOn(service, 'searchByVector').mockResolvedValue([]);
      await service.searchWithMode(tenant, 'kb-1', 'query', AssistantSearchMode.VECTOR, 5);
      expect(spy).toHaveBeenCalled();
    });

    it('routes HYBRID mode to hybridSearch', async () => {
      const spy = jest.spyOn(service, 'hybridSearch').mockResolvedValue([]);
      await service.searchWithMode(tenant, 'kb-1', 'query', AssistantSearchMode.HYBRID, 5);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('AssistantContextService — context builder', () => {
    let service: AssistantContextService;
    const prisma = {
      retrievalLog: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    const bindings = { getEnabledBindings: jest.fn() };
    const retrieval = { searchWithMode: jest.fn() };
    const keyAgents = { assertOwned: jest.fn() };

    beforeEach(async () => {
      jest.clearAllMocks();
      keyAgents.assertOwned.mockResolvedValue(undefined);
      bindings.getEnabledBindings.mockResolvedValue([
        {
          id: 'bind-1',
          knowledgeBaseId: 'kb-1',
          searchMode: AssistantSearchMode.HYBRID,
          maxChunks: 5,
          maxTokens: 500,
          keywordWeight: 0.3,
          vectorWeight: 0.7,
          priority: 0,
          knowledgeBase: { id: 'kb-1', name: 'Docs', embeddingProfileId: 'prof-1' },
        },
      ]);
      retrieval.searchWithMode.mockResolvedValue([
        {
          chunkId: 'c1',
          documentId: 'd1',
          title: 'Doc A',
          content: 'Answer text here',
          score: 0.95,
        },
      ]);
      prisma.retrievalLog.create.mockResolvedValue({ id: 'log-1' });
      prisma.retrievalLog.findUnique.mockResolvedValue({ id: 'log-1', knowledgeBaseId: 'kb-1' });
      prisma.retrievalLog.update.mockResolvedValue({});

      const module = await Test.createTestingModule({
        providers: [
          AssistantContextService,
          { provide: PrismaService, useValue: prisma },
          { provide: KeyAgentService, useValue: keyAgents },
          { provide: AssistantKnowledgeBindingService, useValue: bindings },
          { provide: RetrievalService, useValue: retrieval },
        ],
      }).compile();
      service = module.get(AssistantContextService);
    });

    it('builds context from enabled bindings and writes retrieval log', async () => {
      const result = await service.buildContext(tenant, assistantId, 'What is X?');

      expect(retrieval.searchWithMode).toHaveBeenCalledWith(
        tenant,
        'kb-1',
        'What is X?',
        AssistantSearchMode.HYBRID,
        5,
        expect.objectContaining({ profileId: 'prof-1' }),
      );
      expect(prisma.retrievalLog.create).toHaveBeenCalled();
      expect(result.chunksUsed).toBeGreaterThan(0);
      expect(result.contextText).toContain('Docs');
      expect(result.contextText).toContain('Answer text here');
    });

    it('deduplicates chunks by highest score', async () => {
      bindings.getEnabledBindings.mockResolvedValue([
        {
          id: 'b1',
          knowledgeBaseId: 'kb-1',
          searchMode: AssistantSearchMode.KEYWORD,
          maxChunks: 10,
          maxTokens: 4000,
          keywordWeight: 0.5,
          vectorWeight: 0.5,
          priority: 0,
          knowledgeBase: { id: 'kb-1', name: 'KB1', embeddingProfileId: null },
        },
        {
          id: 'b2',
          knowledgeBaseId: 'kb-2',
          searchMode: AssistantSearchMode.KEYWORD,
          maxChunks: 10,
          maxTokens: 4000,
          keywordWeight: 0.5,
          vectorWeight: 0.5,
          priority: 1,
          knowledgeBase: { id: 'kb-2', name: 'KB2', embeddingProfileId: null },
        },
      ]);
      retrieval.searchWithMode
        .mockResolvedValueOnce([
          { chunkId: 'c-dup', documentId: 'd1', title: 'A', content: 'low score', score: 0.5 },
        ])
        .mockResolvedValueOnce([
          { chunkId: 'c-dup', documentId: 'd1', title: 'A', content: 'high score', score: 0.9 },
        ]);
      prisma.retrievalLog.create
        .mockResolvedValueOnce({ id: 'log-1' })
        .mockResolvedValueOnce({ id: 'log-2' });
      prisma.retrievalLog.findUnique
        .mockResolvedValueOnce({ id: 'log-1', knowledgeBaseId: 'kb-1' })
        .mockResolvedValueOnce({ id: 'log-2', knowledgeBaseId: 'kb-2' });

      const result = await service.buildContext(tenant, assistantId, 'dup test');
      const dup = result.chunks.filter((c) => c.chunkId === 'c-dup');
      expect(dup).toHaveLength(1);
      expect(dup[0].score).toBe(0.9);
    });
  });

  describe('AssistantChatService — debug mode', () => {
    let service: AssistantChatService;
    const keyAgents = { findOne: jest.fn() };
    const variables = { renderPrompt: jest.fn() };
    const context = { buildContext: jest.fn() };
    const openRouter = { getActiveKey: jest.fn(), chatCompletion: jest.fn() };

    beforeEach(async () => {
      jest.clearAllMocks();
      keyAgents.findOne.mockResolvedValue({ settings: { showSources: true } });
      variables.renderPrompt.mockResolvedValue({ rendered: 'You are helpful.' });
      context.buildContext.mockResolvedValue({
        contextText: 'ctx',
        chunks: [
          {
            chunkId: 'c1',
            documentId: 'd1',
            documentTitle: 'Doc',
            knowledgeBaseId: 'kb-1',
            knowledgeBaseName: 'KB',
            content: 'chunk',
            score: 0.88,
          },
        ],
        chunksUsed: 1,
        tokensUsed: 50,
      });
      openRouter.getActiveKey.mockResolvedValue('key-1');
      openRouter.chatCompletion.mockResolvedValue({
        data: { choices: [{ message: { content: 'Answer from LLM' } }] },
      });

      const module = await Test.createTestingModule({
        providers: [
          AssistantChatService,
          { provide: KeyAgentService, useValue: keyAgents },
          { provide: AgentVariableService, useValue: variables },
          { provide: AssistantContextService, useValue: context },
          { provide: OpenRouterService, useValue: openRouter },
        ],
      }).compile();
      service = module.get(AssistantChatService);
    });

    it('includes sources when showSources setting is enabled', async () => {
      const result = await service.chat(tenant, assistantId, 'question');
      expect(result.sources).toBeDefined();
      expect(result.sources!.length).toBe(1);
      expect(result.sources![0].knowledgeBaseName).toBe('KB');
    });

    it('omits sources when debug is off and setting disabled', async () => {
      keyAgents.findOne.mockResolvedValue({ settings: {} });
      const result = await service.chat(tenant, assistantId, 'question', { debug: false });
      expect(result.sources).toBeUndefined();
    });

    it('includes sources when debug flag is true', async () => {
      keyAgents.findOne.mockResolvedValue({ settings: {} });
      const result = await service.chat(tenant, assistantId, 'question', { debug: true });
      expect(result.sources).toBeDefined();
    });
  });
});
