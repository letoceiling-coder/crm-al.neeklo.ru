import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParserClientService } from '../parser-client/parser-client.service';
import { StorageService } from '../storage/storage.service';
import { QueueMonitoringService } from '../queue/queue-monitoring.service';

@Injectable()
export class HealthService {
  constructor(
    private prisma: PrismaService,
    private parser: ParserClientService,
    private storage: StorageService,
    private queues: QueueMonitoringService,
  ) {}

  async check() {
    const [db, parser, storage, queues] = await Promise.all([
      this.checkDatabase(),
      this.parser.health(),
      this.storage.health(),
      this.queues.getHealth(),
    ]);

    const ok = db.ok && parser.ok && storage.ok && queues.redis;

    return {
      ok,
      service: 'ai-gateway-api',
      timestamp: new Date().toISOString(),
      checks: {
        database: db,
        parser,
        storage,
        queues,
      },
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}
