import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface KeywordSearchHit {
  chunkId: string;
  documentId: string;
  score: number;
  content: string;
  title?: string | null;
}

export interface MetadataSearchFilters {
  knowledgeBaseId: string;
  organizationId: string;
  categoryId?: string;
  topicId?: string;
  tagIds?: string[];
  documentId?: string;
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async keywordSearch(
    query: string,
    filters: MetadataSearchFilters,
    limit = 20,
  ): Promise<KeywordSearchHit[]> {
    const q = query.trim();
    if (!q) return [];
    const take = Math.min(limit, 50);

    const rows = await this.prisma.$queryRaw<KeywordSearchHit[]>`
      SELECT c.id as "chunkId", c.document_id as "documentId",
             ts_rank(to_tsvector('simple', c.content), plainto_tsquery('simple', ${q})) as score,
             c.content, d.title
      FROM knowledge_chunks c
      JOIN knowledge_documents d ON d.id = c.document_id
      WHERE c.knowledge_base_id = ${filters.knowledgeBaseId}
        AND c.organization_id = ${filters.organizationId}
        AND (${filters.documentId ?? null}::text IS NULL OR c.document_id = ${filters.documentId})
        AND (${filters.categoryId ?? null}::text IS NULL OR d.category_id = ${filters.categoryId})
        AND (${filters.topicId ?? null}::text IS NULL OR d.topic_id = ${filters.topicId})
        AND to_tsvector('simple', c.content) @@ plainto_tsquery('simple', ${q})
      ORDER BY score DESC
      LIMIT ${take}
    `;
    return rows;
  }

  async metadataSearch(filters: MetadataSearchFilters, limit = 50) {
    const where: Record<string, unknown> = {
      knowledgeBaseId: filters.knowledgeBaseId,
      organizationId: filters.organizationId,
      status: 'READY',
    };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.topicId) where.topicId = filters.topicId;
    if (filters.documentId) where.id = filters.documentId;

    return this.prisma.knowledgeDocument.findMany({
      where,
      take: Math.min(limit, 100),
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        format: true,
        chunkCount: true,
        embeddingStatus: true,
        categoryId: true,
        topicId: true,
        parserChars: true,
      },
    });
  }

  /** Reciprocal Rank Fusion foundation for hybrid search */
  mergeRrf<T extends { chunkId: string }>(
    lists: Array<Array<T & { score: number }>>,
    k = 60,
  ): Array<T & { score: number }> {
    const scores = new Map<string, { item: T & { score: number }; score: number }>();

    for (const list of lists) {
      list.forEach((item, rank) => {
        const rrf = 1 / (k + rank + 1);
        const prev = scores.get(item.chunkId);
        if (prev) {
          prev.score += rrf;
        } else {
          scores.set(item.chunkId, { item, score: rrf });
        }
      });
    }

    return [...scores.values()]
      .sort((a, b) => b.score - a.score)
      .map((v) => ({ ...v.item, score: v.score }));
  }
}
