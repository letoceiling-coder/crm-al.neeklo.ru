import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../cache/redis-cache.service';

export type RateLimitScope = 'organization' | 'apiKey' | 'assistant' | 'integration';

@Injectable()
export class SystemRateLimitService {
  constructor(
    private prisma: PrismaService,
    private cache: RedisCacheService,
  ) {}

  async checkOrganizationRpm(organizationId: string): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const limits = await this.prisma.planLimits.findUnique({ where: { organizationId } });
    const limit = limits?.rpm ?? 120;
    const key = this.cache.buildKey('ratelimit', 'org', organizationId, 'rpm', String(Math.floor(Date.now() / 60_000)));
    const count = await this.increment(key, 90);
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), limit };
  }

  async assertOrganizationRpm(organizationId: string) {
    const result = await this.checkOrganizationRpm(organizationId);
    if (!result.allowed) {
      throw new HttpException(
        { message: 'Organization rate limit exceeded', ...result },
        HttpStatus.TOO_MANY_REQUESTS,
      );
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
    };
  }

  private async increment(key: string, ttlSec: number): Promise<number> {
    return this.cache.incr(key, ttlSec);
  }
}
