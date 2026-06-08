import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvoiceStatus,
  PaymentProviderType,
  PaymentStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillingPlanService, SubscriptionService } from '../billing/billing.service';
import { EmailService } from '../email/email.service';
import { AlertingService } from '../alerting/alerting.service';
import { serializeBigInts } from '../common/utils/serialize.util';
import type { PaymentProviderAdapter } from './payment-provider.interface';
import {
  YooKassaAdapter,
  StripeAdapter,
  RobokassaAdapter,
  CloudPaymentsAdapter,
} from './providers/yookassa.adapter';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly adapters: Map<PaymentProviderType, PaymentProviderAdapter>;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private plans: BillingPlanService,
    private subscriptions: SubscriptionService,
    private email: EmailService,
    private alerting: AlertingService,
    yookassa: YooKassaAdapter,
    stripe: StripeAdapter,
    robokassa: RobokassaAdapter,
    cloudpayments: CloudPaymentsAdapter,
  ) {
    this.adapters = new Map<PaymentProviderType, PaymentProviderAdapter>([
      [PaymentProviderType.YOOKASSA, yookassa],
      [PaymentProviderType.STRIPE, stripe],
      [PaymentProviderType.ROBOKASSA, robokassa],
      [PaymentProviderType.CLOUDPAYMENTS, cloudpayments],
    ]);
  }

  listProviders() {
    return this.prisma.paymentProvider.findMany({
      where: { provider: PaymentProviderType.YOOKASSA },
      orderBy: { provider: 'asc' },
    });
  }

  listPayments(organizationId: string) {
    return this.prisma.payment.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { invoice: { select: { invoiceNumber: true, status: true } } },
    }).then(serializeBigInts);
  }

  async initiatePayment(organizationId: string, invoiceId: string, providerType?: PaymentProviderType) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId, status: InvoiceStatus.OPEN },
    });
    if (!invoice) throw new NotFoundException('Open invoice not found');

    const existing = await this.prisma.payment.findFirst({
      where: { invoiceId, status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] } },
    });
    if (existing?.confirmationUrl) {
      return serializeBigInts(existing);
    }

    const providerRow = await this.resolveProvider(providerType);
    const adapter = this.adapters.get(providerRow.provider);
    if (!adapter) throw new BadRequestException('Payment provider not supported');

    const amount = Number(invoice.amountRub);
    const payment = await this.prisma.payment.create({
      data: {
        invoiceId,
        organizationId,
        providerId: providerRow.id,
        provider: providerRow.provider,
        amount: invoice.amountRub,
        currency: invoice.currency,
        status: PaymentStatus.PENDING,
      },
    });

    const appUrl = this.config.get('APP_PUBLIC_URL', 'https://crm-al.neeklo.ru');
    const result = await adapter.createPayment({
      paymentId: payment.id,
      amount,
      currency: invoice.currency,
      description: invoice.description ?? `Invoice ${invoice.invoiceNumber}`,
      returnUrl: `${appUrl}/billing/invoices?paid=1`,
      metadata: { invoiceId, organizationId, paymentId: payment.id },
    });

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        externalId: result.externalId,
        confirmationUrl: result.confirmationUrl,
        status: result.status === 'succeeded' ? PaymentStatus.SUCCEEDED : PaymentStatus.PROCESSING,
        paidAt: result.status === 'succeeded' ? new Date() : undefined,
      },
    });

    if (result.status === 'succeeded') {
      await this.completePayment(updated.id);
    }

    return serializeBigInts(updated);
  }

  async completeMockPayment(paymentId: string, organizationId: string) {
    if (this.config.get('PAYMENT_MOCK_MODE', 'true') !== 'true') {
      throw new BadRequestException('Mock payments disabled');
    }
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.SUCCEEDED, paidAt: new Date() },
    });
    await this.recordEvent(paymentId, 'mock.succeeded', { paymentId });
    return this.completePayment(paymentId);
  }

  async handleWebhook(providerType: PaymentProviderType, headers: Record<string, string>, body: unknown) {
    const adapter = this.adapters.get(providerType);
    if (!adapter) return { ok: false };

    const parsed = await adapter.parseWebhook(headers, body);
    if (!parsed) return { ok: true, ignored: true };

    const payment = await this.prisma.payment.findFirst({
      where: { externalId: parsed.externalId },
    });
    if (!payment) {
      this.logger.warn(`Webhook for unknown payment ${parsed.externalId}`);
      return { ok: true, ignored: true };
    }

    await this.recordEvent(payment.id, `webhook.${parsed.status}`, parsed.rawEvent);

    if (parsed.status === 'succeeded') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.SUCCEEDED, paidAt: parsed.paidAt ?? new Date() },
      });
      await this.completePayment(payment.id);
    } else if (parsed.status === 'failed' || parsed.status === 'cancelled') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: parsed.status === 'cancelled' ? PaymentStatus.CANCELLED : PaymentStatus.FAILED },
      });
      await this.alerting.paymentFailed(payment.organizationId, payment.id);
    }

    return { ok: true };
  }

  async completePayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: true,
        organization: { include: { members: { where: { role: 'OWNER' }, include: { user: true } } } },
      },
    });
    if (!payment || payment.status !== PaymentStatus.SUCCEEDED) return;

    const invoice = payment.invoice;
    if (invoice.status === InvoiceStatus.PAID) return;

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: InvoiceStatus.PAID, paidAt: payment.paidAt ?? new Date() },
    });

    if (invoice.targetPlanTier) {
      await this.subscriptions.applyPaidPlan(payment.organizationId, invoice.targetPlanTier);
    } else if (invoice.subscriptionId) {
      await this.prisma.subscription.update({
        where: { id: invoice.subscriptionId },
        data: { status: SubscriptionStatus.ACTIVE },
      });
    }

    const owner = payment.organization.members[0]?.user;
    if (owner) {
      await this.email.sendPaymentConfirmation(
        owner.email,
        String(payment.amount),
        payment.currency,
        invoice.invoiceNumber,
      );
      if (invoice.targetPlanTier) {
        const plan = await this.plans.findByTier(invoice.targetPlanTier);
        if (plan) await this.email.sendSubscriptionActivated(owner.email, plan.name);
      }
    }

    await this.alerting.paymentSucceeded(payment.organizationId, payment.id, Number(payment.amount));
    return { completed: true, invoiceId: invoice.id };
  }

  private async resolveProvider(preferred?: PaymentProviderType) {
    if (preferred) {
      const row = await this.prisma.paymentProvider.findUnique({ where: { provider: preferred } });
      if (row?.isEnabled) return row;
    }
    const row = await this.prisma.paymentProvider.findFirst({
      where: { isEnabled: true, isDefault: true },
    });
    if (row) return row;
    const yookassa = await this.prisma.paymentProvider.findUnique({
      where: { provider: PaymentProviderType.YOOKASSA },
    });
    if (!yookassa) throw new BadRequestException('No payment provider configured');
    return yookassa;
  }

  private recordEvent(paymentId: string, eventType: string, payload: unknown) {
    return this.prisma.paymentEvent.create({
      data: { paymentId, eventType, payload: payload as object },
    });
  }
}
