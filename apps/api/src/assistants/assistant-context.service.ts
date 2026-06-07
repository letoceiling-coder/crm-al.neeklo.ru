import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { KeyAgentService } from './key-agent.service';
import { AssistantKnowledgeBindingService } from './assistant-knowledge-binding.service';
import { RetrievalService } from '../knowledge/search/retrieval.service';

export interface ContextChunk {
  chunkId: string;
  documentId: string;
  documentTitle?: string | null;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  content: string;
  score: number;
}

export interface AssistantContextResult {
  query: string;
  contextText: string;
  chunks: ContextChunk[];
  chunksFound: number;
  chunksUsed: number;
  tokensUsed: number;
  latencyMs: number;
  bindingsUsed: number;
  logIds: string[];
}

@Injectable()
export class AssistantContextService {
  constructor(
    private prisma: PrismaService,
    private keyAgents: KeyAgentService,
    private bindings: AssistantKnowledgeBindingService,
    private retrieval: RetrievalService,
  ) {}

  async buildContext(
    tenant: TenantContext,
    assistantId: string,
    query: string,
  ): Promise<AssistantContextResult> {
    const started = Date.now();
    await this.keyAgents.assertOwned(assistantId, tenant.organizationId);

    const bindingList = await this.bindings.getEnabledBindings(
      assistantId,
      tenant.organizationId,
    );

    const allHits: ContextChunk[] = [];
    const logIds: string[] = [];
    let totalFound = 0;
    const maxTokens =
      bindingList.reduce((s, b) => Math.max(s, b.maxTokens), 0) || 2000;

    for (const binding of bindingList) {
      const kbStart = Date.now();
      const hits = await this.retrieval.searchWithMode(
        tenant,
        binding.knowledgeBaseId,
        query,
        binding.searchMode,
        binding.maxChunks,
        {
          keywordWeight: binding.keywordWeight,
          vectorWeight: binding.vectorWeight,
          profileId: binding.knowledgeBase.embeddingProfileId ?? undefined,
        },
      );

      totalFound += hits.length;

      allHits.push(
        ...hits.map((h) => ({
          chunkId: h.chunkId,
          documentId: h.documentId,
          documentTitle: h.title,
          knowledgeBaseId: binding.knowledgeBaseId,
          knowledgeBaseName: binding.knowledgeBase.name,
          content: h.content,
          score: h.score,
        })),
      );

      const log = await this.prisma.retrievalLog.create({
        data: {
          organizationId: tenant.organizationId,
          assistantId,
          knowledgeBaseId: binding.knowledgeBaseId,
          query,
          searchMode: binding.searchMode,
          chunksFound: hits.length,
          chunksUsed: 0,
          tokensUsed: 0,
          latencyMs: Date.now() - kbStart,
          metadata: {
            bindingId: binding.id,
            priority: binding.priority,
            chunkIds: hits.map((h) => h.chunkId),
          },
        },
      });
      logIds.push(log.id);
    }

    const deduped = this.deduplicateChunks(allHits);
    const { selected, tokensUsed } = this.trimToTokenBudget(deduped, maxTokens);
    const contextText = this.formatContext(selected);

    for (const logId of logIds) {
      const log = await this.prisma.retrievalLog.findUnique({ where: { id: logId } });
      if (!log?.knowledgeBaseId) continue;
      const usedFromKb = selected.filter((c) => c.knowledgeBaseId === log.knowledgeBaseId).length;
      await this.prisma.retrievalLog.update({
        where: { id: logId },
        data: { chunksUsed: usedFromKb, tokensUsed: Math.ceil(tokensUsed / Math.max(logIds.length, 1)) },
      });
    }

    return {
      query,
      contextText,
      chunks: selected,
      chunksFound: totalFound,
      chunksUsed: selected.length,
      tokensUsed,
      latencyMs: Date.now() - started,
      bindingsUsed: bindingList.length,
      logIds,
    };
  }

  private deduplicateChunks(chunks: ContextChunk[]): ContextChunk[] {
    const map = new Map<string, ContextChunk>();
    for (const c of chunks) {
      const prev = map.get(c.chunkId);
      if (!prev || c.score > prev.score) map.set(c.chunkId, c);
    }
    return [...map.values()].sort((a, b) => b.score - a.score);
  }

  private trimToTokenBudget(chunks: ContextChunk[], maxTokens: number) {
    const selected: ContextChunk[] = [];
    let tokens = 0;
    for (const chunk of chunks) {
      const est = Math.ceil(chunk.content.length / 4);
      if (tokens + est > maxTokens) break;
      selected.push(chunk);
      tokens += est;
    }
    return { selected, tokensUsed: tokens };
  }

  private formatContext(chunks: ContextChunk[]): string {
    if (!chunks.length) return '';
    return chunks
      .map(
        (c, i) =>
          `[${i + 1}] База: ${c.knowledgeBaseName} | Документ: ${c.documentTitle ?? c.documentId} | score=${c.score.toFixed(3)}\n${c.content}`,
      )
      .join('\n\n---\n\n');
  }
}
