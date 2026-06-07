import { Injectable, BadRequestException } from '@nestjs/common';
import { OpenRouterService } from '../openrouter/openrouter.service';
import { KeyAgentService } from './key-agent.service';
import { AgentVariableService } from './agent-variable.service';
import { AssistantContextService, ContextChunk } from './assistant-context.service';
import { MemorySearchService } from '../memory/memory-search.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
export interface AssistantChatResult {
  answer: string;
  model: string;
  contextUsed: boolean;
  chunksUsed: number;
  tokensUsed: number;
  latencyMs: number;
  sources?: Array<{
    knowledgeBaseId: string;
    knowledgeBaseName: string;
    documentId: string;
    documentTitle?: string | null;
    chunkId: string;
    score: number;
  }>;
  memoryUsed?: boolean;
  memoryHits?: number;
}

@Injectable()
export class AssistantChatService {
  constructor(
    private openRouter: OpenRouterService,
    private keyAgents: KeyAgentService,
    private variables: AgentVariableService,
    private context: AssistantContextService,
    private memorySearch: MemorySearchService,
  ) {}

  async chat(
    tenant: TenantContext,
    assistantId: string,
    query: string,
    options?: { debug?: boolean; model?: string },
  ): Promise<AssistantChatResult> {
    if (!query?.trim()) throw new BadRequestException('Query is required');

    const started = Date.now();
    const agent = await this.keyAgents.findOne(tenant, assistantId);
    if (!agent) throw new BadRequestException('Assistant not found');
    const rendered = await this.variables.renderPrompt(tenant, assistantId);

    const ctx = await this.context.buildContext(tenant, assistantId, query.trim());
    const mem = await this.memorySearch.buildContextForAssistant(tenant, assistantId, query.trim());
    const settings = (agent.settings ?? {}) as {
      modelChain?: string[];
      showSources?: boolean;
      defaultModel?: string;
    };
    const debug = options?.debug ?? settings.showSources ?? false;

    const systemParts = [rendered.rendered];
    if (ctx.contextText) {
      systemParts.push(
        'Используй следующий контекст из баз знаний для ответа. Если контекст не содержит ответа — скажи об этом.\n\n' +
          ctx.contextText,
      );
    }
    if (mem.text) {
      systemParts.push(
        'Долговременная память ассистента (используй как факты о клиенте/организации):\n\n' + mem.text,
      );
    }
    const systemPrompt = systemParts.join('\n\n');

    const model =
      options?.model ??
      settings.defaultModel ??
      (Array.isArray(settings.modelChain) ? settings.modelChain[0] : undefined) ??
      'openai/gpt-4o-mini';

    const orKey = await this.openRouter.getActiveKey();
    if (!orKey) throw new BadRequestException('OpenRouter not configured');

    const { data } = await this.openRouter.chatCompletion(orKey, model, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query.trim() },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    });

    const answer =
      (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message
        ?.content ?? '';

    const result: AssistantChatResult = {
      answer,
      model,
      contextUsed: ctx.chunksUsed > 0 || mem.hits.length > 0,
      chunksUsed: ctx.chunksUsed,
      tokensUsed: ctx.tokensUsed,
      latencyMs: Date.now() - started,
      memoryUsed: mem.hits.length > 0,
      memoryHits: mem.hits.length,
    };

    if (debug && ctx.chunks.length) {
      result.sources = this.formatSources(ctx.chunks);
    }

    return result;
  }

  private formatSources(chunks: ContextChunk[]) {
    const byDoc = new Map<string, ContextChunk>();
    for (const c of chunks) {
      const key = `${c.knowledgeBaseId}:${c.documentId}`;
      if (!byDoc.has(key)) byDoc.set(key, c);
    }
    return chunks.map((c) => ({
      knowledgeBaseId: c.knowledgeBaseId,
      knowledgeBaseName: c.knowledgeBaseName,
      documentId: c.documentId,
      documentTitle: c.documentTitle,
      chunkId: c.chunkId,
      score: c.score,
    }));
  }
}
