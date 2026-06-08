import { Module } from '@nestjs/common';
import { BillingController, BillingAdminController } from './billing.controller';
import {
  BillingPlanService,
  SubscriptionService,
  BillingUsageService,
  CommercialMetricsService,
} from './billing.service';
import { SystemModule } from '../system/system.module';

@Module({
  imports: [SystemModule],
  controllers: [BillingController, BillingAdminController],
  providers: [
    BillingPlanService,
    SubscriptionService,
    BillingUsageService,
    CommercialMetricsService,
  ],
  exports: [BillingPlanService, SubscriptionService, CommercialMetricsService],
})
export class BillingModule {}
