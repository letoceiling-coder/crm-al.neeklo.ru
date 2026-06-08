import { Module } from '@nestjs/common';
import { HealthModule } from '../health/health.module';
import { QueueModule } from '../queue/queue.module';
import { ParserClientModule } from '../parser-client/parser-client.module';
import { StorageModule } from '../storage/storage.module';
import { SystemController } from './system.controller';
import { SystemQueueService } from './system-queue.service';
import { SystemMetricsService } from './system-metrics.service';
import { SystemHealthService } from './system-health.service';
import { SystemDependenciesService } from './system-dependencies.service';
import { SystemSecurityService } from './system-security.service';
import { SystemCostAnomalyService } from './system-cost-anomaly.service';
import { SystemRateLimitService } from './system-rate-limit.service';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
  imports: [HealthModule, QueueModule, ParserClientModule, StorageModule],
  controllers: [SystemController],
  providers: [
    SystemQueueService,
    SystemMetricsService,
    SystemHealthService,
    SystemDependenciesService,
    SystemSecurityService,
    SystemCostAnomalyService,
    SystemRateLimitService,
    AdminGuard,
  ],
  exports: [SystemRateLimitService, SystemQueueService, SystemHealthService, SystemDependenciesService],
})
export class SystemModule {}
