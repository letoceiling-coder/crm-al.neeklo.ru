import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import {
  YooKassaAdapter,
  StripeAdapter,
  RobokassaAdapter,
  CloudPaymentsAdapter,
} from './providers/yookassa.adapter';
import { BillingModule } from '../billing/billing.module';
import { AlertingModule } from '../alerting/alerting.module';

@Module({
  imports: [forwardRef(() => BillingModule), AlertingModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    YooKassaAdapter,
    StripeAdapter,
    RobokassaAdapter,
    CloudPaymentsAdapter,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
