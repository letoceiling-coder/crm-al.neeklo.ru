import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export type CacheNamespace = 'retrieval' | 'embedding' | 'prompt';

export interface CacheStats {
  hits: number;
  misses: number;
  latencyMsTotal: number;
  operations: number;
}

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly client: Redis | null;
  private readonly defaultTtlSec: number;

  constructor(private config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.defaultTtlSec = this.config.get<number>('CACHE_TTL_SEC', 300);
    try {
      this.client = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
      void this.client.connect().catch((err) => {
        this.logger.warn(`Redis cache connect failed: ${(err as Error).message}`);
      });
    } catch {
      this.client = null;
    }
  }

  isAvailable(): boolean {
    return this.client?.status === 'ready';
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  private statsKey(ns: CacheNamespace, metric: keyof CacheStats): string {
    return `cache:stats:${ns}:${metric}`;
  }

  async recordHit(ns: CacheNamespace, latencyMs: number) {
    if (!this.client) return;
    await Promise.all([
      this.client.incr(this.statsKey(ns, 'hits')),
      this.client.incr(this.statsKey(ns, 'operations')),
      this.client.incrbyfloat(this.statsKey(ns, 'latencyMsTotal'), latencyMs),
    ]);
  }

  async recordMiss(ns: CacheNamespace, latencyMs: number) {
    if (!this.client) return;
    await Promise.all([
      this.client.incr(this.statsKey(ns, 'misses')),
      this.client.incr(this.statsKey(ns, 'operations')),
      this.client.incrbyfloat(this.statsKey(ns, 'latencyMsTotal'), latencyMs),
    ]);
  }

  async getStats(ns: CacheNamespace): Promise<CacheStats & { hitRate: number; avgLatencyMs: number }> {
    if (!this.client) {
      return { hits: 0, misses: 0, latencyMsTotal: 0, operations: 0, hitRate: 0, avgLatencyMs: 0 };
    }
    const [hits, misses, latencyMsTotal, operations] = await Promise.all([
      this.client.get(this.statsKey(ns, 'hits')),
      this.client.get(this.statsKey(ns, 'misses')),
      this.client.get(this.statsKey(ns, 'latencyMsTotal')),
      this.client.get(this.statsKey(ns, 'operations')),
    ]);
    const h = Number(hits ?? 0);
    const m = Number(misses ?? 0);
    const lat = Number(latencyMsTotal ?? 0);
    const ops = Number(operations ?? 0);
    const total = h + m;
    return {
      hits: h,
      misses: m,
      latencyMsTotal: lat,
      operations: ops,
      hitRate: total ? h / total : 0,
      avgLatencyMs: ops ? lat / ops : 0,
    };
  }

  async getAllStats() {
    const namespaces: CacheNamespace[] = ['retrieval', 'embedding', 'prompt'];
    const entries = await Promise.all(namespaces.map(async (ns) => [ns, await this.getStats(ns)] as const));
    return Object.fromEntries(entries);
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSec = this.defaultTtlSec): Promise<void> {
    if (!this.client) return;
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSec);
  }

  buildKey(...parts: string[]): string {
    return parts.join(':');
  }

  async incr(key: string, ttlSec = this.defaultTtlSec): Promise<number> {
    if (!this.client) return 0;
    const val = await this.client.incr(key);
    if (val === 1) await this.client.expire(key, ttlSec);
    return val;
  }

  async incrBy(key: string, delta: number, ttlSec = this.defaultTtlSec): Promise<number> {
    if (!this.client) return 0;
    const val = await this.client.incrby(key, delta);
    if (val === delta) await this.client.expire(key, ttlSec);
    return val;
  }

  async getCounter(key: string): Promise<number | null> {
    if (!this.client) return null;
    const raw = await this.client.get(key);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
}
