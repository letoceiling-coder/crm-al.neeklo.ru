import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { UsageService } from './usage.service';
import { UsageLogsQueryDto } from './dto/usage-query.dto';
import { AnalyticsOverviewQueryDto } from './dto/analytics-overview.dto';
import { Public } from '../common/decorators';
import { ApiKeyOrJwtGuard } from '../common/guards/api-key-or-jwt.guard';
import { Request } from 'express';

type AuthRequest = Request & {
  user: { id: string; role: string };
  apiKey?: { id: string };
};

function scopeKey(req: AuthRequest) {
  return req.apiKey?.id;
}

@Controller('v1/usage')
@Public()
@UseGuards(ApiKeyOrJwtGuard)
export class UsageV1Controller {
  constructor(private usageService: UsageService) {}

  @Get()
  overview(@Req() req: AuthRequest) {
    return this.usageService.getOverview(req.user.id, req.user.role, scopeKey(req));
  }

  @Get('models')
  byModels(@Req() req: AuthRequest) {
    return this.usageService.getByModels(req.user.id, req.user.role, scopeKey(req));
  }

  @Get('costs')
  costs(@Req() req: AuthRequest) {
    return this.usageService.getOverview(req.user.id, req.user.role, scopeKey(req));
  }

  @Get('daily')
  daily(@Req() req: AuthRequest) {
    return this.usageService.getDaily(req.user.id, req.user.role, 30, scopeKey(req));
  }

  @Get('monthly')
  monthly(@Req() req: AuthRequest) {
    return this.usageService.getMonthly(req.user.id, req.user.role, 12, scopeKey(req));
  }

  @Get('keys')
  byKeys(@Req() req: AuthRequest) {
    return this.usageService.getByKeys(req.user.id, req.user.role);
  }

  @Get('logs')
  logs(@Req() req: AuthRequest, @Query() query: UsageLogsQueryDto) {
    return this.usageService.getLogs(req.user.id, req.user.role, {
      apiKeyId: scopeKey(req) ?? query.apiKeyId,
      modelId: query.modelId,
      agentId: query.agentId,
      from: query.from,
      to: query.to,
      page: query.page,
      limit: query.limit,
    });
  }
}

@Controller('analytics')
export class AnalyticsController {
  constructor(private usageService: UsageService) {}

  @Get('overview')
  overview(@Req() req: AuthRequest, @Query() query: AnalyticsOverviewQueryDto) {
    return this.usageService.getOverview(req.user.id, req.user.role, query.apiKeyId, {
      from: query.from,
      to: query.to,
    });
  }

  @Get('models')
  byModels(@Req() req: AuthRequest, @Query('apiKeyId') apiKeyId?: string) {
    return this.usageService.getByModels(req.user.id, req.user.role, apiKeyId);
  }

  @Get('daily')
  daily(@Req() req: AuthRequest, @Query('apiKeyId') apiKeyId?: string) {
    return this.usageService.getDaily(req.user.id, req.user.role, 30, apiKeyId);
  }

  @Get('keys-stats')
  keysStats(@Req() req: AuthRequest) {
    return this.usageService.getByKeys(req.user.id, req.user.role);
  }

  @Get('logs')
  logs(@Req() req: AuthRequest, @Query() query: UsageLogsQueryDto) {
    return this.usageService.getLogs(req.user.id, req.user.role, {
      apiKeyId: query.apiKeyId,
      modelId: query.modelId,
      agentId: query.agentId,
      from: query.from,
      to: query.to,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post('recalculate-costs')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  recalculateCosts() {
    return this.usageService.recalculateAllLogCosts();
  }

  @Post('recalculate-billing')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async recalculateBilling(@Query('apiKeyId') apiKeyId?: string) {
    const billing = await this.usageService.recalculateBillingForKey(apiKeyId);
    return billing;
  }
}

@Controller('dashboard')
export class DashboardController {
  constructor(private usageService: UsageService) {}

  @Get()
  async getDashboard(@Req() req: AuthRequest) {
    const [overview, models] = await Promise.all([
      this.usageService.getOverview(req.user.id, req.user.role),
      this.usageService.getByModels(req.user.id, req.user.role),
    ]);
    return { ...overview, topModels: models };
  }
}
