import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { UsageAggregatePeriod } from '@prisma/client';

export type RateLimitScope = 'organization' | 'apiKey' | 'assistant' | 'integration';

export interface PlanUsageSnapshot {
  rpm: { used: number; limit: number; remaining: number };
  dailyRequests: { used: number; limit: number; remaining: number };
  monthlyRequests: { used: number; limit: number; remaining: number };
  monthlyTokens: { used: number; limit: number; remaining: number };
  monthlyStorageMb: { used: number; limit: number; remaining: number };
}

@Injectable()
export class SystemRateLimitService {
  constructor(
    private prisma: PrismaService,
    private cache: RedisCacheService,
  ) {}

  async assertOrganizationLimits(organizationId: string, options?: { tokenDelta?: number }) {
    const limits = await this.getOrganizationLimits(organizationId);
    const now = new Date();
    const minuteBucket = String(Math.floor(now.getTime() / 60_000));
    const dayKey = now.toISOString().slice(0, 10);
    const monthKey = now.toISOString().slice(0, 7);

    const rpmCount = await this.increment(
      this.cache.buildKey('ratelimit', 'org', organizationId, 'rpm', minuteBucket),
      90,
    );
    if (rpmCount > limits.rpm) {
      throw this.limitError('Organization RPM limit exceeded', { limit: limits.rpm, used: rpmCount, scope: 'rpm' });
    }

    const dailyCount = await this.increment(
      this.cache.buildKey('ratelimit', 'org', organizationId, 'daily', dayKey),
      86_400,
    );
    if (dailyCount > limits.dailyRequests) {
      throw this.limitError('Daily request limit exceeded', {
        limit: limits.dailyRequests,
        used: dailyCount,
        scope: 'dailyRequests',
      });
    }

    const monthlyCount = await this.increment(
      this.cache.buildKey('ratelimit', 'org', organizationId, 'monthly-req', monthKey),
      2_592_000,
    );
    if (monthlyCount > limits.monthlyRequests) {
      throw this.limitError('Monthly request limit exceeded', {
        limit: limits.monthlyRequests,
        used: monthlyCount,
        scope: 'monthlyRequests',
      });
    }

    if (options?.tokenDelta && options.tokenDelta > 0) {
      const tokenCount = await this.incrementBy(
        this.cache.buildKey('ratelimit', 'org', organizationId, 'monthly-tokens', monthKey),
        options.tokenDelta,
        2_592_000,
      );
      if (tokenCount > limits.monthlyTokens) {
        throw this.limitError('Monthly token limit exceeded', {
          limit: limits.monthlyTokens,
          used: tokenCount,
          scope: 'monthlyTokens',
        });
      }
    }

    await this.touchUsageAggregate(organizationId, dayKey, monthKey, options?.tokenDelta ?? 0);
  }

  async recordTokenUsage(organizationId: string, tokenDelta: number) {
    if (tokenDelta <= 0) return;
    const limits = await this.getOrganizationLimits(organizationId);
    const monthKey = new Date().toISOString().slice(0, 7);
    const tokenCount = await this.incrementBy(
      this.cache.buildKey('ratelimit', 'org', organizationId, 'monthly-tokens', monthKey),
      tokenDelta,
      2_592_000,
    );
    if (tokenCount > limits.monthlyTokens) {
      throw this.limitError('Monthly token limit exceeded', {
        limit: limits.monthlyTokens,
        used: tokenCount,
        scope: 'monthlyTokens',
      });
    }
    const dayKey = new Date().toISOString().slice(0, 10);
    await this.touchUsageAggregate(organizationId, dayKey, monthKey, tokenDelta);
  }

  async assertApiKeyLimits(apiKeyId: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id: apiKeyId } });
    if (!key) return;

    if (key.rateLimit != null) {
      const minuteBucket = String(Math.floor(Date.now() / 60_000));
      const count = await this.increment(
        this.cache.buildKey('ratelimit', 'apikey', apiKeyId, 'rpm', minuteBucket),
        90,
      );
      if (count > key.rateLimit) {
        throw this.limitError('API key rate limit exceeded', { limit: key.rateLimit, used: count, scope: 'apiKey' });
      }
    }

    if (key.tokenLimit != null && key.tokensUsed >= key.tokenLimit) {
      throw this.limitError('API key token limit exceeded', {
        limit: Number(key.tokenLimit),
        used: Number(key.tokensUsed),
        scope: 'apiKeyTokens',
      });
    }
  }

  async assertStorageLimit(organizationId: string, additionalMb = 0) {
    const limits = await this.getOrganizationLimits(organizationId);
    const usedMb = await this.getOrganizationStorageMb(organizationId);
    if (usedMb + additionalMb > limits.monthlyStorageMb) {
      throw this.limitError('Monthly storage limit exceeded', {
        limit: limits.monthlyStorageMb,
        used: usedMb,
        scope: 'monthlyStorageMb',
      });
    }
  }

  async checkOrganizationRpm(organizationId: string) {
    const limits = await this.getOrganizationLimits(organizationId);
    const key = this.cache.buildKey('ratelimit', 'org', organizationId, 'rpm', String(Math.floor(Date.now() / 60_000)));
    const count = await this.increment(key, 90);
    return { allowed: count <= limits.rpm, remaining: Math.max(0, limits.rpm - count), limit: limits.rpm };
  }

  async assertOrganizationRpm(organizationId: string) {
    const result = await this.checkOrganizationRpm(organizationId);
    if (!result.allowed) {
      throw this.limitError('Organization rate limit exceeded', result);
    }
  }

  async getOrganizationLimits(organizationId: string) {
    const limits = await this.prisma.planLimits.findUnique({ where: { organizationId } });
    return {
      rpm: limits?.rpm ?? 120,
      dailyRequests: limits?.dailyRequests ?? 10000,
      monthlyRequests: limits?.monthlyRequests ?? 300000,
      monthlyTokens: Number(limits?.monthlyTokens ?? 10_000_000),
      monthlyStorageMb: limits?.monthlyStorageMb ?? 5120,
      planName: limits?.planName ?? 'free',
    };
  }

  async getOrganizationUsage(organizationId: string): Promise<PlanUsageSnapshot> {
    const limits = await this.getOrganizationLimits(organizationId);
    const now = new Date();
    const minuteBucket = String(Math.floor(now.getTime() / 60_000));
    const dayKey = now.toISOString().slice(0, 10);
    const monthKey = now.toISOString().slice(0, 7);

    const rpmUsed = await this.cache.getCounter(
      this.cache.buildKey('ratelimit', 'org', organizationId, 'rpm', minuteBucket),
    );
    const dailyUsed = await this.cache.getCounter(
      this.cache.buildKey('ratelimit', 'org', organizationId, 'daily', dayKey),
    );
    const monthlyReqUsed = await this.cache.getCounter(
      this.cache.buildKey('ratelimit', 'org', organizationId, 'monthly-req', monthKey),
    );
    const monthlyTokensUsed = await this.cache.getCounter(
      this.cache.buildKey('ratelimit', 'org', organizationId, 'monthly-tokens', monthKey),
    );
    const storageUsed = await this.getOrganizationStorageMb(organizationId);

    const snap = (used: number | null, limit: number) => ({
      used: used ?? 0,
      limit,
      remaining: Math.max(0, limit - (used ?? 0)),
    });

    return {
      rpm: snap(rpmUsed, limits.rpm),
      dailyRequests: snap(dailyUsed, limits.dailyRequests),
      monthlyRequests: snap(monthlyReqUsed, limits.monthlyRequests),
      monthlyTokens: snap(monthlyTokensUsed, limits.monthlyTokens),
      monthlyStorageMb: snap(storageUsed, limits.monthlyStorageMb),
    };
  }

  private async getOrganizationStorageMb(organizationId: string): Promise<number> {
    const agg = await this.prisma.usageAggregate.findUnique({
      where: {
        organizationId_periodType_periodKey: {
          organizationId,
          periodType: UsageAggregatePeriod.MONTH,
          periodKey: new Date().toISOString().slice(0, 7),
        },
      },
    });
    if (agg?.storageMb) return agg.storageMb;

    const result = await this.prisma.knowledgeDocument.aggregate({
      where: { organizationId },
      _sum: { parserChars: true, chunkCount: true },
    });
    const chars = Number(result._sum.parserChars ?? 0) || Number(result._sum.chunkCount ?? 0) * 500;
    return Math.max(1, Math.ceil(chars / (1024 * 1024)));
  }

  private async touchUsageAggregate(organizationId: string, dayKey: string, monthKey: string, tokenDelta: number) {
    await this.prisma.usageAggregate.upsert({
      where: {
        organizationId_periodType_periodKey: {
          organizationId,
          periodType: UsageAggregatePeriod.DAY,
          periodKey: dayKey,
        },
      },
      create: {
        organizationId,
        periodType: UsageAggregatePeriod.DAY,
        periodKey: dayKey,
        requestCount: 1,
        tokenCount: BigInt(tokenDelta),
      },
      update: {
        requestCount: { increment: 1 },
        tokenCount: tokenDelta > 0 ? { increment: tokenDelta } : undefined,
      },
    });

    await this.prisma.usageAggregate.upsert({
      where: {
        organizationId_periodType_periodKey: {
          organizationId,
          periodType: UsageAggregatePeriod.MONTH,
          periodKey: monthKey,
        },
      },
      create: {
        organizationId,
        periodType: UsageAggregatePeriod.MONTH,
        periodKey: monthKey,
        requestCount: 1,
        tokenCount: BigInt(tokenDelta),
      },
      update: {
        requestCount: { increment: 1 },
        tokenCount: tokenDelta > 0 ? { increment: tokenDelta } : undefined,
      },
    });
  }

  private limitError(message: string, details: Record<string, unknown>) {
    return new HttpException({ message, ...details }, HttpStatus.TOO_MANY_REQUESTS);
  }

  private async increment(key: string, ttlSec: number): Promise<number> {
    return this.cache.incr(key, ttlSec);
  }

  private async incrementBy(key: string, delta: number, ttlSec: number): Promise<number> {
    return this.cache.incrBy(key, delta, ttlSec);
  }
}
