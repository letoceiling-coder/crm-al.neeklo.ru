import { Injectable } from '@nestjs/common';
import { HealthService } from '../health/health.service';
import { SystemQueueService } from './system-queue.service';
import { getAppRole } from '../config/app-role';

@Injectable()
export class SystemHealthService {
  constructor(
    private health: HealthService,
    private queues: SystemQueueService,
  ) {}

  async getSystemHealth() {
    const [base, queueMetrics] = await Promise.all([
      this.health.check(),
      this.queues.getQueueMetrics(),
    ]);

    const queueOk = queueMetrics.summary.degradedQueues === 0 && queueMetrics.redis;

    return {
      ok: base.ok && queueOk,
      role: getAppRole(),
      timestamp: new Date().toISOString(),
      checks: base.checks,
      queues: {
        ok: queueOk,
        degraded: queueMetrics.summary.degradedQueues,
        redis: queueMetrics.redis,
      },
    };
  }
}
