import { Injectable, NotFoundException } from '@nestjs/common';
import { MemorySearchMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { MemoryProfileService } from './memory-profile.service';
import { MemoryEmbeddingService } from './memory-embedding.service';
import { EmbeddingClientService } from '../knowledge/embedding/embedding-client.service';
import { MemorySearchDto } from './dto/memory.dto';

export interface MemorySearchHit {
  entryId: string;
  content: string;
  entryType: string;
  importance: number;
  score: number;
  source?: string | null;
  reason?: string;
}

@Injectable()
export class MemorySearchService {
  constructor(
    private prisma: PrismaService,
    private profiles: MemoryProfileService,
    private memoryEmbed: MemoryEmbeddingService,
    private embedClient: EmbeddingClientService,
  ) {}

  async search(tenant: TenantContext, dto: MemorySearchDto): Promise<{
    hits: MemorySearchHit[];
    profileId: string;
    mode: MemorySearchMode;
    latencyMs: number;
    debug?: Record<string, unknown>;
  }> {
    const started = Date.now();
    const profile = await this.profiles.resolveProfile(tenant, {
      profileId: dto.profileId,
      entityType: dto.entityType,
      entityId: dto.entityId,
    });

    const mode = dto.mode ?? MemorySearchMode.HYBRID;
    const limit = dto.limit ?? 10;
    const q = dto.query.trim();
    if (!q) {
      return { hits: [], profileId: profile.id, mode, latencyMs: 0 };
    }

    let hits: MemorySearchHit[] = [];
    const debug: Record<string, unknown> = {};

    if (mode === MemorySearchMode.KEYWORD || mode === MemorySearchMode.HYBRID) {
      const keyword = await this.keywordSearch(profile.id, tenant.organizationId, q, limit);
      debug.keywordCount = keyword.length;
      hits = keyword;
    }

    if (mode === MemorySearchMode.VECTOR || mode === MemorySearchMode.HYBRID) {
      const vector = await this.vectorSearch(profile.id, tenant.organizationId, q, limit).catch(() => []);
      debug.vectorCount = vector.length;
      if (mode === MemorySearchMode.VECTOR) {
        hits = vector;
      } else if (vector.length) {
        hits = this.mergeHybrid(hits, vector, limit);
      }
    }

    hits = hits.slice(0, limit).map((h) => ({
      ...h,
      reason: h.reason ?? this.explainScore(h.score, mode),
    }));

    const latencyMs = Date.now() - started;

    await this.prisma.memorySearchLog.create({
      data: {
        organizationId: tenant.organizationId,
        profileId: profile.id,
        assistantId: dto.assistantId,
        query: q,
        mode,
        results: hits as object,
        resultCount: hits.length,
        latencyMs,
        debug: (dto.debug ? { ...debug, hits: hits.map((h) => ({ id: h.entryId, score: h.score, reason: h.reason })) } : debug) as object,
      },
    });

    return {
      hits,
      profileId: profile.id,
      mode,
      latencyMs,
      ...(dto.debug ? { debug } : {}),
    };
  }

  async readForWorkflow(
    tenant: TenantContext,
    config: Record<string, unknown>,
    context: Record<string, unknown>,
  ) {
    const query = String(
      config.query ?? config.q ?? (context.trigger as Record<string, unknown>)?.query ?? '',
    ).trim();
    if (!query) throw new Error('Memory query required');

    const result = await this.search(tenant, {
      query,
      profileId: config.profileId ? String(config.profileId) : undefined,
      entityType: config.entityType as never,
      entityId: config.entityId ? String(config.entityId) : undefined,
      mode: (config.mode as MemorySearchMode) ?? MemorySearchMode.HYBRID,
      limit: Number(config.limit ?? 5),
      debug: true,
    });

    return {
      hits: result.hits,
      profileId: result.profileId,
      query,
      latencyMs: result.latencyMs,
    };
  }

  async buildContextForAssistant(
    tenant: TenantContext,
    assistantId: string,
    query: string,
    limit = 5,
  ): Promise<{ text: string; hits: MemorySearchHit[] }> {
    const profile = await this.prisma.memoryProfile.findUnique({
      where: {
        organizationId_entityType_entityId: {
          organizationId: tenant.organizationId,
          entityType: 'ASSISTANT',
          entityId: assistantId,
        },
      },
    });
    if (!profile || profile.status !== 'ACTIVE') {
      return { text: '', hits: [] };
    }

    const result = await this.search(tenant, {
      query,
      profileId: profile.id,
      mode: MemorySearchMode.HYBRID,
      limit,
      assistantId,
    });

    if (!result.hits.length) return { text: '', hits: [] };

    const text = result.hits
      .map((h, i) => `[${i + 1}] (${h.entryType}, score=${h.score.toFixed(2)}) ${h.content}`)
      .join('\n');

    return { text, hits: result.hits };
  }

  private async keywordSearch(
    profileId: string,
    organizationId: string,
    query: string,
    limit: number,
  ): Promise<MemorySearchHit[]> {
    const rows = await this.prisma.$queryRaw<MemorySearchHit[]>`
      SELECT e.id as "entryId", e.content, e.entry_type as "entryType", e.importance, e.source,
             ts_rank(to_tsvector('simple', e.content), plainto_tsquery('simple', ${query})) as score
      FROM memory_entries e
      WHERE e.profile_id = ${profileId}
        AND e.organization_id = ${organizationId}
        AND to_tsvector('simple', e.content) @@ plainto_tsquery('simple', ${query})
      ORDER BY score DESC, e.importance DESC
      LIMIT ${Math.min(limit, 50)}
    `;
    return rows.map((r) => ({ ...r, score: Number(r.score), reason: 'keyword match' }));
  }

  private async vectorSearch(
    profileId: string,
    organizationId: string,
    query: string,
    limit: number,
  ): Promise<MemorySearchHit[]> {
    const embeddingProfileId = await this.memoryEmbed.resolveEmbeddingProfileId(organizationId);
    if (!embeddingProfileId) return [];

    const profile = await this.prisma.embeddingProfile.findUnique({ where: { id: embeddingProfileId } });
    if (!profile) throw new NotFoundException('Embedding profile not found');

    const queryVector = await this.embedClient.embedText(profile, query, organizationId);
    const rows = await this.memoryEmbed.vectorSearch({
      queryVector,
      embeddingProfileId,
      organizationId,
      profileId,
      limit,
    });

    const entries = await this.prisma.memoryEntry.findMany({
      where: { id: { in: rows.map((r) => r.entryId) } },
      select: { id: true, importance: true, source: true },
    });
    const meta = new Map(entries.map((e) => [e.id, e]));

    return rows.map((r) => ({
      entryId: r.entryId,
      content: r.content,
      entryType: r.entryType,
      importance: meta.get(r.entryId)?.importance ?? 5,
      source: meta.get(r.entryId)?.source,
      score: Number(r.score),
      reason: 'vector similarity',
    }));
  }

  private mergeHybrid(keyword: MemorySearchHit[], vector: MemorySearchHit[], limit: number): MemorySearchHit[] {
    const map = new Map<string, MemorySearchHit>();
    for (const h of keyword) {
      map.set(h.entryId, { ...h, score: h.score * 0.3, reason: 'hybrid (keyword)' });
    }
    for (const h of vector) {
      const prev = map.get(h.entryId);
      if (prev) {
        map.set(h.entryId, {
          ...prev,
          score: prev.score + h.score * 0.7,
          reason: 'hybrid (keyword+vector)',
        });
      } else {
        map.set(h.entryId, { ...h, score: h.score * 0.7, reason: 'hybrid (vector)' });
      }
    }
    return [...map.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private explainScore(score: number, mode: MemorySearchMode): string {
    if (mode === MemorySearchMode.KEYWORD) return 'matched by full-text search';
    if (mode === MemorySearchMode.VECTOR) return 'matched by semantic similarity';
    return score > 0.5 ? 'strong hybrid match' : 'partial hybrid match';
  }
}
