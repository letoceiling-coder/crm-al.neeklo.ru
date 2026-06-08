import { Injectable } from '@nestjs/common';
import * as os from 'os';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { SystemQueueService } from './system-queue.service';
import { StorageService } from '../storage/storage.service';
import { ParserClientService } from '../parser-client/parser-client.service';
import { ProviderAccountsService } from '../provider-accounts/provider-accounts.service';

@Injectable()
export class SystemMetricsService {
  constructor(
    private prisma: PrismaService,
    private cache: RedisCacheService,
    private queues: SystemQueueService,
    private storage: StorageService,
    private parser: ParserClientService,
  ) {}

  async collect() {
    const mem = process.memoryUsage();
    const [queueMetrics, cacheStats, dbStats, integrationStats] = await Promise.all([
      this.queues.getQueueMetrics(),
      this.cache.getAllStats(),
      this.dbStats(),
      this.integrationStats(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      process: {
        pid: process.pid,
        uptimeSec: Math.round(process.uptime()),
        role: process.env.APP_ROLE ?? 'api',
      },
      cpu: {
        loadAvg: os.loadavg(),
        cores: os.cpus().length,
      },
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        systemFreeMb: Math.round(os.freemem() / 1024 / 1024),
        systemTotalMb: Math.round(os.totalmem() / 1024 / 1024),
      },
      redis: {
        connected: queueMetrics.redis,
        cacheAvailable: this.cache.isAvailable(),
      },
      postgresql: dbStats,
      bullmq: queueMetrics.summary,
      s3: await this.storage.health(),
      parser: await this.parser.health(),
      openrouter: { configured: true },
      integrations: integrationStats,
      cache: cacheStats,
    };
  }

  private async dbStats() {
    try {
      const [orgs, assistants, chunks, executions] = await Promise.all([
        this.prisma.organization.count(),
        this.prisma.keyAgent.count(),
        this.prisma.knowledgeChunk.count(),
        this.prisma.workflowExecution.count(),
      ]);
      return { ok: true, organizations: orgs, assistants, knowledgeChunks: chunks, workflowExecutions: executions };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  private async integrationStats() {
    try {
      const [accounts, pendingEvents] = await Promise.all([
        this.prisma.integrationAccount.count(),
        this.prisma.integrationEvent.count({ where: { status: 'PENDING' } }),
      ]);
      return { accounts, pendingEvents };
    } catch {
      return { accounts: 0, pendingEvents: 0 };
    }
  }
}
