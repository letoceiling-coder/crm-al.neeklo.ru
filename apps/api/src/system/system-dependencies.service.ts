import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ParserClientService } from '../parser-client/parser-client.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SystemDependenciesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private parser: ParserClientService,
    private cache: RedisCacheService,
    private config: ConfigService,
  ) {}

  async checkAll() {
    const [db, storage, parser, redis] = await Promise.all([
      this.checkDb(),
      this.storage.health(),
      this.parser.health(),
      this.checkRedis(),
    ]);

    const openrouter = {
      ok: Boolean(this.config.get('OPENROUTER_API_KEY') || this.config.get('OPENROUTER_DEFAULT_KEY')),
      name: 'OpenRouter',
    };

    return {
      ok: db.ok && storage.ok && parser.ok && redis.ok,
      dependencies: [
        { name: 'PostgreSQL', ...db },
        { name: 'Redis', ...redis },
        { name: 'S3', ...storage, ok: storage.ok },
        { name: 'Parser', ...parser, ok: parser.ok },
        openrouter,
      ],
    };
  }

  private async checkDb() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: 0 };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  private async checkRedis() {
    return { ok: this.cache.isAvailable() };
  }
}
