import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_KB_STATS, KbStats } from './knowledge.utils';

@Injectable()
export class KnowledgeStatsService {
  constructor(private prisma: PrismaService) {}

  async refresh(knowledgeBaseId: string): Promise<KbStats> {
    const [documents, sources] = await Promise.all([
      this.prisma.knowledgeDocument.groupBy({
        by: ['status'],
        where: { knowledgeBaseId },
        _count: { _all: true },
      }),
      this.prisma.knowledgeSource.count({ where: { knowledgeBaseId } }),
    ]);

    const byStatus = Object.fromEntries(documents.map((d) => [d.status, d._count._all]));
    const readyCount = byStatus.READY ?? 0;
    const failedCount = byStatus.FAILED ?? 0;
    const skippedQualityCount = byStatus.SKIPPED_QUALITY ?? 0;
    const pendingCount = (byStatus.PENDING ?? 0) + (byStatus.PROCESSING ?? 0);
    const documentCount = documents.reduce((s, d) => s + d._count._all, 0);

    const charAgg = await this.prisma.knowledgeDocument.aggregate({
      where: { knowledgeBaseId, status: 'READY' },
      _sum: { parserChars: true },
    });

    const chunkCount = await this.prisma.knowledgeChunk.count({
      where: { knowledgeBaseId },
    });

    const indexedCount = await this.prisma.knowledgeDocument.count({
      where: { knowledgeBaseId, embeddingStatus: 'INDEXED' },
    });

    const stats: KbStats = {
      documentCount,
      sourceCount: sources,
      readyCount,
      failedCount,
      skippedQualityCount,
      pendingCount,
      totalChars: charAgg._sum.parserChars ?? 0,
      chunkCount,
      indexedCount,
    };

    await this.prisma.knowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: { stats: stats as object },
    });

    return stats;
  }
}
