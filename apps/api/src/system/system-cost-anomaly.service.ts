import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CostAnomaly {
  type: 'organization' | 'apiKey' | 'assistant' | 'spike';
  entityId: string;
  entityLabel: string;
  metric: string;
  current: number;
  baseline: number;
  ratio: number;
  severity: 'warning' | 'critical';
}

@Injectable()
export class SystemCostAnomalyService {
  constructor(private prisma: PrismaService) {}

  async detect(limit = 20): Promise<CostAnomaly[]> {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [orgUsage, keyUsage, assistantUsage, recentTokens, baselineTokens] = await Promise.all([
      this.prisma.usageLog.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: since24h } },
        _sum: { totalTokens: true, userCost: true },
        orderBy: { _sum: { totalTokens: 'desc' } },
        take: 10,
      }),
      this.prisma.usageLog.groupBy({
        by: ['apiKeyId'],
        where: { createdAt: { gte: since24h }, apiKeyId: { not: null } },
        _sum: { totalTokens: true, userCost: true },
        orderBy: { _sum: { totalTokens: 'desc' } },
        take: 10,
      }),
      this.prisma.usageLog.groupBy({
        by: ['agentId'],
        where: { createdAt: { gte: since24h }, agentId: { not: null } },
        _sum: { totalTokens: true },
        orderBy: { _sum: { totalTokens: 'desc' } },
        take: 10,
      }),
      this.prisma.usageLog.aggregate({
        where: { createdAt: { gte: since24h } },
        _sum: { totalTokens: true, userCost: true },
      }),
      this.prisma.usageLog.aggregate({
        where: { createdAt: { gte: since7d, lt: since24h } },
        _sum: { totalTokens: true, userCost: true },
      }),
    ]);

    const anomalies: CostAnomaly[] = [];
    const recentTotal = Number(recentTokens._sum.totalTokens ?? 0);
    const baselineTotal = Number(baselineTokens._sum.totalTokens ?? 0) / 6 || 1;
    const spikeRatio = recentTotal / baselineTotal;

    if (spikeRatio >= 2) {
      anomalies.push({
        type: 'spike',
        entityId: 'platform',
        entityLabel: 'Platform-wide',
        metric: 'tokens_24h',
        current: recentTotal,
        baseline: Math.round(baselineTotal),
        ratio: Math.round(spikeRatio * 100) / 100,
        severity: spikeRatio >= 5 ? 'critical' : 'warning',
      });
    }

    for (const row of keyUsage) {
      const tokens = Number(row._sum.totalTokens ?? 0);
      if (tokens < 50_000) continue;
      anomalies.push({
        type: 'apiKey',
        entityId: row.apiKeyId!,
        entityLabel: `API Key ${row.apiKeyId!.slice(0, 8)}`,
        metric: 'tokens_24h',
        current: tokens,
        baseline: 10_000,
        ratio: tokens / 10_000,
        severity: tokens >= 500_000 ? 'critical' : 'warning',
      });
    }

    for (const row of assistantUsage) {
      const tokens = Number(row._sum.totalTokens ?? 0);
      if (tokens < 30_000) continue;
      anomalies.push({
        type: 'assistant',
        entityId: row.agentId!,
        entityLabel: `Assistant ${row.agentId!.slice(0, 8)}`,
        metric: 'tokens_24h',
        current: tokens,
        baseline: 5_000,
        ratio: tokens / 5_000,
        severity: tokens >= 200_000 ? 'critical' : 'warning',
      });
    }

    for (const row of orgUsage.slice(0, 5)) {
      const cost = Number(row._sum.userCost ?? 0);
      if (cost < 100) continue;
      anomalies.push({
        type: 'organization',
        entityId: row.userId,
        entityLabel: `User/org ${row.userId.slice(0, 8)}`,
        metric: 'cost_24h_rub',
        current: cost,
        baseline: 50,
        ratio: cost / 50,
        severity: cost >= 1000 ? 'critical' : 'warning',
      });
    }

    return anomalies.sort((a, b) => b.ratio - a.ratio).slice(0, limit);
  }
}
