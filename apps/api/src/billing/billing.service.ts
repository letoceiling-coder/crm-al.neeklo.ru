import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  BillingPlanTier,
  InvoiceStatus,
  SubscriptionStatus,
  UsageAggregatePeriod,
  AgentStatus,
  MarketplaceInstallStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { serializeBigInts } from '../common/utils/serialize.util';

@Injectable()
export class BillingPlanService {
  constructor(private prisma: PrismaService) {}

  async listPlans() {
    const plans = await this.prisma.billingPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return serializeBigInts(plans);
  }

  findByTier(tier: BillingPlanTier) {
    return this.prisma.billingPlan.findUnique({ where: { tier } });
  }

  async syncPlanLimitsToOrganization(organizationId: string, planId: string) {
    const plan = await this.prisma.billingPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    await this.prisma.planLimits.upsert({
      where: { organizationId },
      create: {
        organizationId,
        planName: plan.tier.toLowerCase(),
        maxApiKeys: plan.maxApiKeys,
        maxAssistants: plan.maxAssistants,
        maxAgentApiKeys: plan.maxAgentApiKeys,
        maxKnowledgeBases: plan.maxKnowledgeBases,
        maxDocuments: plan.maxDocuments,
        maxChunks: plan.maxChunks,
        maxToolInstances: plan.maxToolInstances,
        maxStorageMb: plan.maxStorageMb,
        maxSources: plan.maxSources,
        maxJobs: plan.maxJobs,
        maxMemoryProfiles: plan.maxMemoryProfiles,
        maxMemoryEntries: plan.maxMemoryEntries,
        maxMemoryStorageMb: plan.maxMemoryStorageMb,
        rpm: plan.rpm,
        dailyRequests: plan.dailyRequests,
        monthlyRequests: plan.monthlyRequests,
        monthlyTokens: plan.monthlyTokens,
        monthlyStorageMb: plan.monthlyStorageMb,
      },
      update: {
        planName: plan.tier.toLowerCase(),
        maxApiKeys: plan.maxApiKeys,
        maxAssistants: plan.maxAssistants,
        maxAgentApiKeys: plan.maxAgentApiKeys,
        maxKnowledgeBases: plan.maxKnowledgeBases,
        maxDocuments: plan.maxDocuments,
        maxChunks: plan.maxChunks,
        maxToolInstances: plan.maxToolInstances,
        maxStorageMb: plan.maxStorageMb,
        maxSources: plan.maxSources,
        maxJobs: plan.maxJobs,
        maxMemoryProfiles: plan.maxMemoryProfiles,
        maxMemoryEntries: plan.maxMemoryEntries,
        maxMemoryStorageMb: plan.maxMemoryStorageMb,
        rpm: plan.rpm,
        dailyRequests: plan.dailyRequests,
        monthlyRequests: plan.monthlyRequests,
        monthlyTokens: plan.monthlyTokens,
        monthlyStorageMb: plan.monthlyStorageMb,
      },
    });
  }
}

@Injectable()
export class SubscriptionService {
  constructor(
    private prisma: PrismaService,
    private plans: BillingPlanService,
  ) {}

  async getOrCreate(organizationId: string) {
    let sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });
    if (sub) return serializeBigInts(sub);

    const freePlan = await this.plans.findByTier(BillingPlanTier.FREE);
    if (!freePlan) throw new NotFoundException('FREE plan not configured');

    const now = new Date();
    sub = await this.prisma.subscription.create({
      data: {
        organizationId,
        planId: freePlan.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: now,
        renewalDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
      include: { plan: true },
    });
    await this.plans.syncPlanLimitsToOrganization(organizationId, freePlan.id);
    return serializeBigInts(sub);
  }

  async changePlan(organizationId: string, tier: BillingPlanTier) {
    const plan = await this.plans.findByTier(tier);
    if (!plan) throw new NotFoundException('Plan not found');

    const current = await this.getOrCreate(organizationId);
    const currentTier = (current as { plan?: { tier: BillingPlanTier } }).plan?.tier;
    if (currentTier === tier) return current;

    const price = Number(plan.priceMonthlyRub);
    const now = new Date();
    const renewal = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // FREE or ENTERPRISE (contract): apply immediately
    if (price <= 0 || tier === BillingPlanTier.ENTERPRISE) {
      return this.applyPaidPlan(organizationId, tier);
    }

    // Paid tier: invoice OPEN, activate on payment
    const sub = await this.prisma.subscription.findUnique({ where: { organizationId } });
    if (!sub) throw new NotFoundException('Subscription not found');

    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId,
        subscriptionId: sub.id,
        invoiceNumber: `INV-${organizationId.slice(-6)}-${Date.now()}`,
        amountRub: plan.priceMonthlyRub,
        currency: plan.currency,
        status: InvoiceStatus.OPEN,
        targetPlanTier: tier,
        periodStart: now,
        periodEnd: renewal,
        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        description: `Подписка ${plan.name}`,
      },
    });

    return serializeBigInts({
      pending: true,
      invoice,
      subscription: sub,
      message: 'Invoice created — complete payment to activate plan',
    });
  }

  async applyPaidPlan(organizationId: string, tier: BillingPlanTier) {
    const plan = await this.plans.findByTier(tier);
    if (!plan) throw new NotFoundException('Plan not found');

    const now = new Date();
    const renewal = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const sub = await this.prisma.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: now,
        renewalDate: renewal,
      },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        renewalDate: renewal,
        cancelledAt: null,
        endDate: null,
      },
      include: { plan: true },
    });

    await this.plans.syncPlanLimitsToOrganization(organizationId, plan.id);
    return serializeBigInts(sub);
  }

  async cancelSubscription(organizationId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { organizationId } });
    if (!sub) throw new NotFoundException('Subscription not found');

    const updated = await this.prisma.subscription.update({
      where: { organizationId },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        endDate: sub.renewalDate ?? new Date(),
      },
      include: { plan: true },
    });
    return serializeBigInts(updated);
  }

  async renewSubscription(organizationId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.status !== SubscriptionStatus.CANCELLED && sub.status !== SubscriptionStatus.EXPIRED) {
      throw new BadRequestException('Subscription is already active');
    }

    const price = Number(sub.plan.priceMonthlyRub);
    if (price > 0) {
      return this.changePlan(organizationId, sub.plan.tier);
    }

    const renewal = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const updated = await this.prisma.subscription.update({
      where: { organizationId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        cancelledAt: null,
        endDate: null,
        renewalDate: renewal,
      },
      include: { plan: true },
    });
    return serializeBigInts(updated);
  }
}

@Injectable()
export class BillingUsageService {
  constructor(private prisma: PrismaService) {}

  async getUsageSummary(organizationId: string) {
    const monthKey = new Date().toISOString().slice(0, 7);
    const [monthly, dailyRows, tokenCost] = await Promise.all([
      this.prisma.usageAggregate.findUnique({
        where: {
          organizationId_periodType_periodKey: {
            organizationId,
            periodType: UsageAggregatePeriod.MONTH,
            periodKey: monthKey,
          },
        },
      }),
      this.prisma.usageAggregate.findMany({
        where: { organizationId, periodType: UsageAggregatePeriod.DAY },
        orderBy: { periodKey: 'desc' },
        take: 30,
      }),
      this.prisma.usageLog.aggregate({
        where: {
          apiKey: { organizationId },
          createdAt: { gte: new Date(`${monthKey}-01`) },
        },
        _sum: { userCost: true, totalTokens: true },
        _count: true,
      }),
    ]);

    return {
      currentMonth: monthKey,
      requests: monthly?.requestCount ?? 0,
      tokens: Number(monthly?.tokenCount ?? 0),
      storageMb: monthly?.storageMb ?? 0,
      costRub: Number(tokenCost._sum.userCost ?? 0),
      apiCallsLogged: tokenCost._count,
      daily: dailyRows.map((d) => ({
        date: d.periodKey,
        requests: d.requestCount,
        tokens: Number(d.tokenCount),
        costRub: Number(d.costRub),
      })),
    };
  }

  async listInvoices(organizationId: string) {
    const rows = await this.prisma.invoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return serializeBigInts(rows);
  }
}

@Injectable()
export class CommercialMetricsService {
  constructor(private prisma: PrismaService) {}

  async getPlatformMetrics() {
    const [
      orgCount,
      userCount,
      activeAssistants,
      marketplaceInstalls,
      subscriptions,
      paidInvoices,
    ] = await Promise.all([
      this.prisma.organization.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.keyAgent.count({ where: { status: AgentStatus.ACTIVE } }),
      this.prisma.marketplaceInstall.count({ where: { status: MarketplaceInstallStatus.ACTIVE } }),
      this.prisma.subscription.findMany({ include: { plan: true } }),
      this.prisma.invoice.aggregate({
        where: { status: InvoiceStatus.PAID },
        _sum: { amountRub: true },
      }),
    ]);

    const mrr = subscriptions
      .filter((s) => s.status === SubscriptionStatus.ACTIVE)
      .reduce((sum, s) => sum + Number(s.plan.priceMonthlyRub), 0);

    const tokenRevenue = await this.prisma.usageLog.aggregate({
      _sum: { userCost: true },
      where: { createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
    });

    return {
      mrr,
      arr: mrr * 12,
      organizations: orgCount,
      activeUsers: userCount,
      activeAssistants,
      marketplaceInstalls,
      tokenRevenueRub: Number(tokenRevenue._sum.userCost ?? 0),
      storageRevenueRub: 0,
      paidInvoicesTotalRub: Number(paidInvoices._sum.amountRub ?? 0),
      subscriptionsByTier: subscriptions.reduce(
        (acc, s) => {
          acc[s.plan.tier] = (acc[s.plan.tier] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}
