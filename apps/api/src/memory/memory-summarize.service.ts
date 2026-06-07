import { Injectable, Logger } from '@nestjs/common';
import { MemoryEntryType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryEntryService } from './memory-entry.service';
import { MemoryEmbeddingService } from './memory-embedding.service';

export interface MemorySummarizeJobPayload {
  profileId: string;
  organizationId: string;
  period?: string;
  maxEntries?: number;
}

@Injectable()
export class MemorySummarizeService {
  private readonly logger = new Logger(MemorySummarizeService.name);

  constructor(
    private prisma: PrismaService,
    private entries: MemoryEntryService,
    private embeddings: MemoryEmbeddingService,
  ) {}

  async run(payload: MemorySummarizeJobPayload) {
    const profile = await this.prisma.memoryProfile.findFirst({
      where: { id: payload.profileId, organizationId: payload.organizationId },
    });
    if (!profile) {
      this.logger.warn(`Profile ${payload.profileId} not found`);
      return;
    }

    const maxEntries = payload.maxEntries ?? 50;
    const period = payload.period ?? 'rolling-7d';

    const entries = await this.prisma.memoryEntry.findMany({
      where: {
        profileId: profile.id,
        entryType: { not: MemoryEntryType.SUMMARY },
      },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take: maxEntries,
    });

    if (entries.length < 3) return;

    const lines = entries.map(
      (e, i) => `${i + 1}. [${e.entryType}] (важность ${e.importance}) ${e.content}`,
    );
    const summaryText = `Сводка памяти (${period}, ${entries.length} записей):\n${lines.join('\n')}`;
    const tokensSaved = entries.reduce((s, e) => s + Math.ceil(e.charCount / 4), 0);

    const tenant = {
      organizationId: payload.organizationId,
      userId: 'system',
      email: 'memory@system',
      role: 'USER' as never,
      organizationRole: 'OWNER' as never,
    };

    await this.prisma.memorySummary.create({
      data: {
        profileId: profile.id,
        summary: summaryText,
        period,
        tokensSaved,
        entryCount: entries.length,
      },
    });

    const summaryEntry = await this.entries.create(
      tenant,
      profile.id,
      {
        content: summaryText,
        entryType: MemoryEntryType.SUMMARY,
        importance: 8,
        source: 'memory-summarize',
        metadata: { period, entryCount: entries.length },
      },
      { skipIndex: false },
    );

    void this.embeddings.indexEntry(summaryEntry.id, payload.organizationId, summaryText);

    return { summaryId: summaryEntry.id, entryCount: entries.length, tokensSaved };
  }

  async enqueue(profileId: string, organizationId: string, period?: string) {
    return { profileId, organizationId, period };
  }
}
