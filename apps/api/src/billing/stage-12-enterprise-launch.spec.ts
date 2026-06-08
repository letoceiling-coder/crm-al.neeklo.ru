import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InvoiceStatus, BillingPlanTier, PaymentStatus } from '@prisma/client';
import { SubscriptionService, BillingPlanService } from './billing.service';
import { PaymentsService } from '../payments/payments.service';
import { YooKassaAdapter } from '../payments/providers/yookassa.adapter';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { AlertingService } from '../alerting/alerting.service';
import { SignupService } from '../auth/signup.service';

describe('Stage 12 — Enterprise Launch Readiness', () => {
  describe('SubscriptionService — paid plan flow', () => {
    it('creates OPEN invoice for paid tier without immediate activation', async () => {
      const proPlan = { id: 'plan-pro', tier: BillingPlanTier.PRO, priceMonthlyRub: 4990, currency: 'RUB', name: 'Pro' };
      const prisma = {
        subscription: {
          findUnique: jest.fn().mockResolvedValue({ id: 'sub-1', plan: { tier: BillingPlanTier.FREE } }),
        },
        billingPlan: { findUnique: jest.fn().mockResolvedValue(proPlan) },
        invoice: { create: jest.fn().mockResolvedValue({ id: 'inv-1', status: InvoiceStatus.OPEN }) },
      };
      const plans = {
        findByTier: jest.fn().mockResolvedValue(proPlan),
        syncPlanLimitsToOrganization: jest.fn(),
      };
      const mod = await Test.createTestingModule({
        providers: [
          SubscriptionService,
          { provide: PrismaService, useValue: prisma },
          { provide: BillingPlanService, useValue: plans },
        ],
      }).compile();

      const svc = mod.get(SubscriptionService);
      jest.spyOn(svc, 'getOrCreate').mockResolvedValue({ plan: { tier: BillingPlanTier.FREE } } as never);

      const result = await svc.changePlan('org-1', BillingPlanTier.PRO);
      expect((result as { pending?: boolean }).pending).toBe(true);
      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it('applyPaidPlan syncs limits', async () => {
      const plan = { id: 'p1', tier: BillingPlanTier.PRO };
      const prisma = {
        billingPlan: { findUnique: jest.fn().mockResolvedValue(plan) },
        subscription: {
          upsert: jest.fn().mockResolvedValue({ id: 's1', plan, status: 'ACTIVE' }),
        },
      };
      const plans = {
        findByTier: jest.fn().mockResolvedValue(plan),
        syncPlanLimitsToOrganization: jest.fn().mockResolvedValue(undefined),
      };
      const mod = await Test.createTestingModule({
        providers: [
          SubscriptionService,
          { provide: PrismaService, useValue: prisma },
          { provide: BillingPlanService, useValue: plans },
        ],
      }).compile();
      await mod.get(SubscriptionService).applyPaidPlan('org-1', BillingPlanTier.PRO);
      expect(plans.syncPlanLimitsToOrganization).toHaveBeenCalledWith('org-1', 'p1');
    });
  });

  describe('YooKassaAdapter — mock mode', () => {
    it('creates mock payment with confirmation URL', async () => {
      const mod = await Test.createTestingModule({
        providers: [
          YooKassaAdapter,
          { provide: ConfigService, useValue: { get: () => 'true' } },
        ],
      }).compile();
      const result = await mod.get(YooKassaAdapter).createPayment({
        paymentId: 'pay-1',
        amount: 4990,
        currency: 'RUB',
        description: 'Test',
        returnUrl: 'http://localhost/billing',
      });
      expect(result.externalId).toMatch(/^mock_/);
      expect(result.confirmationUrl).toContain('mockPayment');
    });
  });

  describe('SignupService', () => {
    it('blocks registration when disabled', async () => {
      const mod = await Test.createTestingModule({
        providers: [
          SignupService,
          { provide: PrismaService, useValue: {} },
          { provide: ConfigService, useValue: { get: () => 'false' } },
          { provide: BillingPlanService, useValue: {} },
        ],
      }).compile();
      expect(() => mod.get(SignupService).assertRegistrationEnabled()).toThrow();
    });
  });
});
