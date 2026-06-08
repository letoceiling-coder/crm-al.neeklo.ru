import { Injectable } from '@nestjs/common';
import { MarketplaceInstallStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SystemQueueService } from '../system/system-queue.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class SupportDashboardService {
  constructor(
    private prisma: PrismaService,
    private queues: SystemQueueService,
    private storage: StorageService,
  ) {}

  async getOverview() {
    const [organizations, errorsToday, queueMetrics, marketplaceIssues] = await Promise.all([
      this.prisma.organization.findMany({
        where: { isActive: true },
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          planLimits: true,
          subscription: { include: { plan: true } },
          _count: { select: { members: true, keyAgents: true } },
        },
      }),
      this.prisma.usageLog.count({
        where: {
          status: 'ERROR',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.queues.getQueueMetrics(),
      this.prisma.marketplaceInstall.count({ where: { status: MarketplaceInstallStatus.FAILED } }),
    ]);

    return {
      organizations: organizations.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        plan: o.subscription?.plan?.tier ?? o.planLimits?.planName ?? 'free',
        members: o._count.members,
        assistants: o._count.keyAgents,
      })),
      errorsLast24h: errorsToday,
      queueFailures: queueMetrics.queues.reduce((s, q) => s + (q.failed ?? 0), 0),
      marketplaceIssues,
      queues: queueMetrics.queues.filter((q) => (q.failed ?? 0) > 0 || (q.lagMs ?? 0) > 10_000),
    };
  }
}

@Injectable()
export class BackupCenterService {
  constructor(
    private config: ConfigService,
    private storage: StorageService,
  ) {}

  async getStatus() {
    const backupDir = this.config.get<string>('BACKUP_DIR', '/var/backups');
    const lastBackup = this.config.get<string>('LAST_BACKUP_AT');
    const s3Configured = this.storage.isConfigured();

    return {
      database: {
        backupDir,
        lastBackup: lastBackup ?? null,
        recoveryStatus: lastBackup ? 'READY' : 'UNKNOWN',
      },
      s3: {
        configured: s3Configured,
        bucket: this.config.get<string>('S3_BUCKET', 'crm-al-knowledge'),
        usageNote: 'Per-tenant prefixes enforced',
      },
      recommendations: [
        'Pre-deploy snapshots stored under /var/backups on production server',
        'Run pg_dump before major migrations',
        'PM2 ecosystem dump: pm2 save',
      ],
    };
  }
}
