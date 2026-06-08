import { PaymentProviderType } from '@prisma/client';

export interface PaymentProviderAdapter {
  readonly type: PaymentProviderType;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  parseWebhook(headers: Record<string, string>, body: unknown): Promise<WebhookResult | null>;
}

export interface CreatePaymentInput {
  paymentId: string;
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentResult {
  externalId: string;
  confirmationUrl?: string;
  status: 'pending' | 'succeeded';
}

export interface WebhookResult {
  externalId: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  paidAt?: Date;
  rawEvent: unknown;
}

export const PAYMENT_ADAPTERS = Symbol('PAYMENT_ADAPTERS');
