import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';
import { EmbeddingClientService } from '../knowledge/embedding/embedding-client.service';

@Injectable()
export class MemoryEmbeddingService {
  constructor(
    private prisma: PrismaService,
    private embedClient: EmbeddingClientService,
  ) {}

  formatVector(values: number[]): string {
    return `[${values.join(',')}]`;
  }

  async resolveEmbeddingProfileId(organizationId: string): Promise<string | null> {
    const orgDefault = await this.prisma.embeddingProfile.findFirst({
      where: { organizationId, isActive: true, isDefault: true },
    });
    if (orgDefault) return orgDefault.id;

    const anyOrg = await this.prisma.embeddingProfile.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (anyOrg) return anyOrg.id;

    const global = await this.prisma.embeddingProfile.findFirst({
      where: { organizationId: null, isActive: true, isDefault: true },
    });
    return global?.id ?? null;
  }

  async indexEntry(entryId: string, organizationId: string, content: string) {
    const profileId = await this.resolveEmbeddingProfileId(organizationId);
    if (!profileId) return null;

    const profile = await this.prisma.embeddingProfile.findUnique({ where: { id: profileId } });
    if (!profile?.isActive) return null;

    const vector = await this.embedClient.embedText(profile, content, organizationId);
    const id = randomUUID();
    const vec = this.formatVector(vector.slice(0, profile.dimensions));

    await this.prisma.$executeRaw`
      INSERT INTO memory_embeddings (id, entry_id, profile_id, dimensions, embedding, created_at)
      VALUES (${id}, ${entryId}, ${profileId}, ${profile.dimensions}, ${vec}::vector, NOW())
      ON CONFLICT (entry_id)
      DO UPDATE SET profile_id = EXCLUDED.profile_id, dimensions = EXCLUDED.dimensions, embedding = EXCLUDED.embedding
    `;

    return { id, profileId };
  }

  async vectorSearch(params: {
    queryVector: number[];
    embeddingProfileId: string;
    organizationId: string;
    profileId: string;
    limit: number;
  }): Promise<Array<{ entryId: string; score: number; content: string; entryType: string }>> {
    const vec = this.formatVector(params.queryVector);
    const limit = Math.min(params.limit, 50);

    return this.prisma.$queryRaw`
      SELECT e.id as "entryId",
             1 - (me.embedding <=> ${vec}::vector) as score,
             e.content,
             e.entry_type as "entryType"
      FROM memory_embeddings me
      JOIN memory_entries e ON e.id = me.entry_id
      WHERE me.profile_id = ${params.embeddingProfileId}
        AND e.profile_id = ${params.profileId}
        AND e.organization_id = ${params.organizationId}
      ORDER BY me.embedding <=> ${vec}::vector
      LIMIT ${limit}
    `;
  }

  async deleteForEntry(entryId: string) {
    await this.prisma.memoryEmbedding.deleteMany({ where: { entryId } });
  }
}
