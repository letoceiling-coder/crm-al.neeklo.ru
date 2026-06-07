import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class EmbeddingStoreService {
  constructor(private prisma: PrismaService) {}

  formatVector(values: number[]): string {
    return `[${values.join(',')}]`;
  }

  async upsertEmbedding(params: {
    chunkId: string;
    profileId: string;
    dimensions: number;
    vector: number[];
  }) {
    const id = randomUUID();
    const vec = this.formatVector(params.vector.slice(0, params.dimensions));

    await this.prisma.$executeRaw`
      INSERT INTO knowledge_embeddings (id, chunk_id, profile_id, dimensions, embedding, created_at)
      VALUES (${id}, ${params.chunkId}, ${params.profileId}, ${params.dimensions}, ${vec}::vector, NOW())
      ON CONFLICT (chunk_id, profile_id)
      DO UPDATE SET dimensions = EXCLUDED.dimensions, embedding = EXCLUDED.embedding
    `;

    return id;
  }

  async deleteForDocument(documentId: string, profileId?: string) {
    if (profileId) {
      await this.prisma.$executeRaw`
        DELETE FROM knowledge_embeddings e
        USING knowledge_chunks c
        WHERE e.chunk_id = c.id AND c.document_id = ${documentId} AND e.profile_id = ${profileId}
      `;
    } else {
      await this.prisma.$executeRaw`
        DELETE FROM knowledge_embeddings e
        USING knowledge_chunks c
        WHERE e.chunk_id = c.id AND c.document_id = ${documentId}
      `;
    }
  }

  async deleteForKnowledgeBase(knowledgeBaseId: string, profileId?: string) {
    if (profileId) {
      await this.prisma.$executeRaw`
        DELETE FROM knowledge_embeddings e
        USING knowledge_chunks c
        WHERE e.chunk_id = c.id AND c.knowledge_base_id = ${knowledgeBaseId} AND e.profile_id = ${profileId}
      `;
    } else {
      await this.prisma.$executeRaw`
        DELETE FROM knowledge_embeddings e
        USING knowledge_chunks c
        WHERE e.chunk_id = c.id AND c.knowledge_base_id = ${knowledgeBaseId}
      `;
    }
  }

  async vectorSearch(params: {
    queryVector: number[];
    profileId: string;
    knowledgeBaseId: string;
    organizationId: string;
    limit: number;
    categoryId?: string;
    topicId?: string;
  }): Promise<Array<{ chunkId: string; documentId: string; score: number; content: string }>> {
    const vec = this.formatVector(params.queryVector);
    const limit = Math.min(params.limit, 50);

    if (params.categoryId || params.topicId) {
      return this.prisma.$queryRaw`
        SELECT c.id as "chunkId", c.document_id as "documentId",
               1 - (e.embedding <=> ${vec}::vector) as score, c.content
        FROM knowledge_embeddings e
        JOIN knowledge_chunks c ON c.id = e.chunk_id
        JOIN knowledge_documents d ON d.id = c.document_id
        WHERE e.profile_id = ${params.profileId}
          AND c.knowledge_base_id = ${params.knowledgeBaseId}
          AND c.organization_id = ${params.organizationId}
          AND (${params.categoryId ?? null}::text IS NULL OR d.category_id = ${params.categoryId})
          AND (${params.topicId ?? null}::text IS NULL OR d.topic_id = ${params.topicId})
        ORDER BY e.embedding <=> ${vec}::vector
        LIMIT ${limit}
      `;
    }

    return this.prisma.$queryRaw`
      SELECT c.id as "chunkId", c.document_id as "documentId",
             1 - (e.embedding <=> ${vec}::vector) as score, c.content
      FROM knowledge_embeddings e
      JOIN knowledge_chunks c ON c.id = e.chunk_id
      WHERE e.profile_id = ${params.profileId}
        AND c.knowledge_base_id = ${params.knowledgeBaseId}
        AND c.organization_id = ${params.organizationId}
      ORDER BY e.embedding <=> ${vec}::vector
      LIMIT ${limit}
    `;
  }
}
