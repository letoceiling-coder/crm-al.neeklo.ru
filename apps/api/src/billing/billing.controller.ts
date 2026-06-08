import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../tenant/tenant.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import {
  BillingPlanService,
  SubscriptionService,
  BillingUsageService,
  CommercialMetricsService,
} from './billing.service';
import { SystemRateLimitService } from '../system/system-rate-limit.service';
import { ChangePlanDto } from './dto/billing.dto';

@ApiTags('billing')
@Controller('v1/billing')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class BillingController {
  constructor(
    private plans: BillingPlanService,
    private subscriptions: SubscriptionService,
    private usage: BillingUsageService,
    private rateLimits: SystemRateLimitService,
  ) {}

  @Get('plans')
  @ApiOperation({ summary: 'List billing plans' })
  listPlans() {
    return this.plans.listPlans();
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Current organization subscription' })
  async getSubscription(@CurrentTenant() tenant: TenantContext) {
    return this.subscriptions.getOrCreate(tenant.organizationId);
  }

  @Post('subscription/change')
  @ApiOperation({ summary: 'Change subscription plan — paid tiers require payment' })
  changePlan(@CurrentTenant() tenant: TenantContext, @Body() dto: ChangePlanDto) {
    return this.subscriptions.changePlan(tenant.organizationId, dto.tier);
  }

  @Post('subscription/cancel')
  @ApiOperation({ summary: 'Cancel subscription at period end' })
  cancel(@CurrentTenant() tenant: TenantContext) {
    return this.subscriptions.cancelSubscription(tenant.organizationId);
  }

  @Post('subscription/renew')
  @ApiOperation({ summary: 'Renew cancelled subscription' })
  renew(@CurrentTenant() tenant: TenantContext) {
    return this.subscriptions.renewSubscription(tenant.organizationId);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Usage summary for current organization' })
  getUsage(@CurrentTenant() tenant: TenantContext) {
    return this.usage.getUsageSummary(tenant.organizationId);
  }

  @Get('limits')
  @ApiOperation({ summary: 'Plan limits and current usage counters' })
  async getLimits(@CurrentTenant() tenant: TenantContext) {
    const [limits, usage] = await Promise.all([
      this.rateLimits.getOrganizationLimits(tenant.organizationId),
      this.rateLimits.getOrganizationUsage(tenant.organizationId),
    ]);
    return { limits, usage };
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Organization invoices' })
  listInvoices(@CurrentTenant() tenant: TenantContext) {
    return this.usage.listInvoices(tenant.organizationId);
  }
}

@ApiTags('billing-admin')
@Controller('v1/billing/admin')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class BillingAdminController {
  constructor(private metrics: CommercialMetricsService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Platform commercial metrics (MRR, ARR, etc.)' })
  getMetrics() {
    return this.metrics.getPlatformMetrics();
  }
}
