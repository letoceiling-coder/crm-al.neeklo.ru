import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../common/guards/admin.guard';
import { SystemQueueService } from './system-queue.service';
import { SystemMetricsService } from './system-metrics.service';
import { SystemHealthService } from './system-health.service';
import { SystemDependenciesService } from './system-dependencies.service';
import { SystemSecurityService } from './system-security.service';
import { SystemCostAnomalyService } from './system-cost-anomaly.service';

@ApiTags('System')
@ApiBearerAuth()
@Controller('v1/system')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class SystemController {
  constructor(
    private queues: SystemQueueService,
    private metrics: SystemMetricsService,
    private health: SystemHealthService,
    private dependencies: SystemDependenciesService,
    private security: SystemSecurityService,
    private costAnomalies: SystemCostAnomalyService,
  ) {}

  @Get('queues')
  @ApiOperation({ summary: 'BullMQ queue metrics (admin)' })
  getQueues() {
    return this.queues.getQueueMetrics();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Platform system metrics (admin)' })
  getMetrics() {
    return this.metrics.collect();
  }

  @Get('health')
  @ApiOperation({ summary: 'Extended system health (admin)' })
  getHealth() {
    return this.health.getSystemHealth();
  }

  @Get('dependencies')
  @ApiOperation({ summary: 'External dependency status (admin)' })
  getDependencies() {
    return this.dependencies.checkAll();
  }

  @Get('security')
  @ApiOperation({ summary: 'Security diagnostics (admin)' })
  getSecurity() {
    return this.security.diagnostics();
  }

  @Get('cost-anomalies')
  @ApiOperation({ summary: 'Cost anomaly detection (admin)' })
  getCostAnomalies() {
    return this.costAnomalies.detect();
  }
}
