import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { PaymentProviderType } from '@prisma/client';
import { SystemIntegrationsService } from '../../system-settings/system-integrations.service';
import {
  PaymentProviderAdapter,
  CreatePaymentInput,
  CreatePaymentResult,
  WebhookResult,
} from '../payment-provider.interface';

@Injectable()
export class YooKassaAdapter implements PaymentProviderAdapter {
  readonly type = PaymentProviderType.YOOKASSA;
  private readonly logger = new Logger(YooKassaAdapter.name);

  constructor(
    private config: ConfigService,
    private integrations: SystemIntegrationsService,
  ) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const { shopId, secretKey, mockMode } = await this.integrations.getPaymentCredentials(
      PaymentProviderType.YOOKASSA,
    );

    if (mockMode) {
      const externalId = `mock_${randomUUID()}`;
      this.logger.log(`Mock YooKassa payment ${externalId} for ${input.amount} ${input.currency}`);
      return {
        externalId,
        confirmationUrl: `${input.returnUrl}?mockPayment=${externalId}&paymentId=${input.paymentId}`,
        status: 'pending',
      };
    }

    if (!shopId || !secretKey) {
      throw new Error('YooKassa credentials not configured');
    }

    const idempotenceKey = input.paymentId;
    const res = await axios.post(
      'https://api.yookassa.ru/v3/payments',
      {
        amount: { value: input.amount.toFixed(2), currency: input.currency },
        confirmation: { type: 'redirect', return_url: input.returnUrl },
        capture: true,
        description: input.description,
        metadata: input.metadata ?? {},
      },
      {
        auth: { username: shopId, password: secretKey },
        headers: { 'Idempotence-Key': idempotenceKey, 'Content-Type': 'application/json' },
      },
    );

    const data = res.data;
    return {
      externalId: data.id,
      confirmationUrl: data.confirmation?.confirmation_url,
      status: data.status === 'succeeded' ? 'succeeded' : 'pending',
    };
  }

  async parseWebhook(
    headers: Record<string, string>,
    body: unknown,
  ): Promise<WebhookResult | null> {
    const payload = body as { event?: string; object?: { id: string; status: string; paid?: boolean } };
    if (!payload?.object?.id) return null;

    const { mockMode } = await this.integrations.getPaymentCredentials(PaymentProviderType.YOOKASSA);

    if (mockMode && headers['x-mock-payment'] === 'true') {
      return {
        externalId: payload.object.id,
        status: 'succeeded',
        paidAt: new Date(),
        rawEvent: payload,
      };
    }

    const statusMap: Record<string, WebhookResult['status']> = {
      succeeded: 'succeeded',
      canceled: 'cancelled',
      waiting_for_capture: 'pending' as WebhookResult['status'],
    };
    const status = statusMap[payload.object.status];
    if (!status || status === ('pending' as WebhookResult['status'])) return null;

    return {
      externalId: payload.object.id,
      status: status === ('pending' as WebhookResult['status']) ? 'failed' : status,
      paidAt: payload.object.status === 'succeeded' ? new Date() : undefined,
      rawEvent: payload,
    };
  }
}

/** Placeholder adapters — implement when integrating */
@Injectable()
export class StripeAdapter implements PaymentProviderAdapter {
  readonly type = PaymentProviderType.STRIPE;
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    throw new Error(`Stripe not configured — payment ${input.paymentId}`);
  }
  async parseWebhook(): Promise<WebhookResult | null> {
    return null;
  }
}

@Injectable()
export class RobokassaAdapter implements PaymentProviderAdapter {
  readonly type = PaymentProviderType.ROBOKASSA;
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    throw new Error(`Robokassa not configured — payment ${input.paymentId}`);
  }
  async parseWebhook(): Promise<WebhookResult | null> {
    return null;
  }
}

@Injectable()
export class CloudPaymentsAdapter implements PaymentProviderAdapter {
  readonly type = PaymentProviderType.CLOUDPAYMENTS;
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    throw new Error(`CloudPayments not configured — payment ${input.paymentId}`);
  }
  async parseWebhook(): Promise<WebhookResult | null> {
    return null;
  }
}
