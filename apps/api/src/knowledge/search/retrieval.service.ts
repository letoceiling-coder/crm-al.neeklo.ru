import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { SearchService, MetadataSearchFilters } from './search.service';
import { EmbeddingStoreService } from '../embedding/embedding-store.service';
import { EmbeddingClientService } from '../embedding/embedding-client.service';
import { KnowledgeBaseService } from '../knowledge-base.service';
import { AssistantSearchMode } from '@prisma/client';

export interface RetrievalHit {
  chunkId: string;
  documentId: string;
  score: number;
  content: string;
  title?: string | null;
  knowledgeBaseId?: string;
  knowledgeBaseName?: string;
}

export interface RetrievalOptions {
  keywordWeight?: number;
  vectorWeight?: number;
  profileId?: string;
}

@Injectable()
export class RetrievalService {
  constructor(
    private prisma: PrismaService,
    private kb: KnowledgeBaseService,
    private search: SearchService,
    private store: EmbeddingStoreService,
    private embedClient: EmbeddingClientService,
  ) {}

  async searchByKeyword(
    tenant: TenantContext,
    knowledgeBaseId: string,
    query: string,
    limit = 20,
    filters?: Partial<MetadataSearchFilters>,
  ): Promise<RetrievalHit[]> {
    await this.kb.assertOwned(knowledgeBaseId, tenant.organizationId);
    return this.search.keywordSearch(query, {
      knowledgeBaseId,
      organizationId: tenant.organizationId,
      ...filters,
    }, limit);
  }

  async searchByVector(
    tenant: TenantContext,
    knowledgeBaseId: string,
    query: string,
    limit = 20,
    profileId?: string,
    filters?: Partial<MetadataSearchFilters>,
  ): Promise<RetrievalHit[]> {
    await this.kb.assertOwned(knowledgeBaseId, tenant.organizationId);
    const kb = await this.prisma.knowledgeBase.findUnique({ where: { id: knowledgeBaseId } });
    const pid = profileId ?? kb?.embeddingProfileId;
    if (!pid) throw new NotFoundException('Embedding profile not configured');

    const profile = await this.prisma.embeddingProfile.findUnique({ where: { id: pid } });
    if (!profile) throw new NotFoundException('Embedding profile not found');

    const queryVector = await this.embedClient.embedText(profile, query, tenant.organizationId);
    const hits = await this.store.vectorSearch({
      queryVector,
      profileId: pid,
      knowledgeBaseId,
      organizationId: tenant.organizationId,
      limit,
      categoryId: filters?.categoryId,
      topicId: filters?.topicId,
    });

    const docTitles = await this.loadTitles(hits.map((h) => h.documentId));
    return hits.map((h) => ({
      ...h,
      score: Number(h.score),
      title: docTitles.get(h.documentId) ?? null,
    }));
  }

  async hybridSearch(
    tenant: TenantContext,
    knowledgeBaseId: string,
    query: string,
    limit = 20,
    profileId?: string,
    filters?: Partial<MetadataSearchFilters>,
    options?: RetrievalOptions,
  ): Promise<RetrievalHit[]> {
    const kw = options?.keywordWeight ?? 0.3;
    const vw = options?.vectorWeight ?? 0.7;

    const [keyword, vector] = await Promise.all([
      this.searchByKeyword(tenant, knowledgeBaseId, query, limit, filters),
      this.searchByVector(tenant, knowledgeBaseId, query, limit, profileId ?? options?.profileId, filters).catch(
        () => [],
      ),
    ]);

    if (keyword.length && vector.length) {
      return this.mergeWeighted(keyword, vector, kw, vw, limit);
    }
    if (vector.length) return vector.slice(0, limit);
    return keyword.slice(0, limit);
  }

  async searchWithMode(
    tenant: TenantContext,
    knowledgeBaseId: string,
    query: string,
    mode: AssistantSearchMode,
    limit = 20,
    options?: RetrievalOptions,
  ): Promise<RetrievalHit[]> {
    if (mode === AssistantSearchMode.KEYWORD) {
      return this.searchByKeyword(tenant, knowledgeBaseId, query, limit);
    }
    if (mode === AssistantSearchMode.VECTOR) {
      return this.searchByVector(tenant, knowledgeBaseId, query, limit, options?.profileId);
    }
    return this.hybridSearch(tenant, knowledgeBaseId, query, limit, options?.profileId, {}, options);
  }

  private mergeWeighted(
    keyword: RetrievalHit[],
    vector: RetrievalHit[],
    keywordWeight: number,
    vectorWeight: number,
    limit: number,
  ): RetrievalHit[] {
    const maxK = Math.max(...keyword.map((h) => h.score), 0.0001);
    const maxV = Math.max(...vector.map((h) => h.score), 0.0001);
    const scores = new Map<string, RetrievalHit & { score: number }>();

    keyword.forEach((h, i) => {
      const norm = h.score / maxK;
      const w = keywordWeight * norm + keywordWeight * (1 / (i + 1));
      scores.set(h.chunkId, { ...h, score: w });
    });

    vector.forEach((h, i) => {
      const norm = h.score / maxV;
      const w = vectorWeight * norm + vectorWeight * (1 / (i + 1));
      const prev = scores.get(h.chunkId);
      if (prev) {
        prev.score += w;
      } else {
        scores.set(h.chunkId, { ...h, score: w });
      }
    });

    return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private async loadTitles(documentIds: string[]): Promise<Map<string, string | null>> {
    const unique = [...new Set(documentIds)];
    if (!unique.length) return new Map();
    const docs = await this.prisma.knowledgeDocument.findMany({
      where: { id: { in: unique } },
      select: { id: true, title: true },
    });
    return new Map(docs.map((d) => [d.id, d.title]));
  }
}
