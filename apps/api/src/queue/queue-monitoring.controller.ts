import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { QueueMonitoringService } from './queue-monitoring.service';
import { Roles, Public } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller()
export class QueueMonitoringController {
  constructor(private monitoring: QueueMonitoringService) {}

  @Public()
  @Get('health/queues')
  health() {
    return this.monitoring.getHealth();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/queues/stats')
  stats() {
    return this.monitoring.getHealth();
  }
}
