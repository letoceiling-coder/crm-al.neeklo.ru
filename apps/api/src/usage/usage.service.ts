import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calculateTokenCost } from '../common/utils/crypto.util';
import {
  computeUserCostRub,
  inferProfileSlugFromEffectiveRate,
} from '../common/utils/billing.util';
import { serializeBigInts } from '../common/utils/serialize.util';
import { ExchangeRateService } from '../currency/exchange-rate.service';
import { RequestStatus, UserRole } from '@prisma/client';

export interface LogUsageParams {
  userId: string;
  apiKeyId?: string;
  agentId?: string;
  modelId?: string;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  realCost: number;
  userCost: number;
  responseTimeMs: number;
  status: RequestStatus;
  errorMessage?: string;
  fallbackUsed?: boolean;
  requestPath?: string;
  ipAddress?: string;
  profileSlug?: string;
}

@Injectable()
export class UsageService {
  constructor(
    private prisma: PrismaService,
    private exchange: ExchangeRateService,
  ) {}

  async logUsage(params: LogUsageParams) {
    const totalTokens = params.inputTokens + params.outputTokens;
    const margin = params.userCost - params.realCost;

    const log = await this.prisma.usageLog.create({
      data: {
        userId: params.userId,
        apiKeyId: params.apiKeyId,
        agentId: params.agentId,
        modelId: params.modelId,
        modelUsed: params.modelUsed,
        profileSlug: params.profileSlug,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        totalTokens,
        realCost: params.realCost,
        userCost: params.userCost,
        margin,
        responseTimeMs: params.responseTimeMs,
        status: params.status,
        errorMessage: params.errorMessage,
        fallbackUsed: params.fallbackUsed ?? false,
        requestPath: params.requestPath,
        ipAddress: params.ipAddress,
      },
    });

    if (params.apiKeyId) {
      await this.prisma.apiKey.update({
        where: { id: params.apiKeyId },
        data: {
          tokensUsed: { increment: totalTokens },
          requestsUsed: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });
    }

    return log;
  }

  async getOverview(
    userId: string,
    role: string,
    apiKeyId?: string,
    period?: { from?: string; to?: string },
  ) {
    const where: Record<string, unknown> = role === UserRole.ADMIN ? {} : { userId };
    if (apiKeyId) where.apiKeyId = apiKeyId;
    if (period?.from || period?.to) {
      where.createdAt = {};
      if (period.from) {
        (where.createdAt as Record<string, Date>).gte = new Date(period.from);
      }
      if (period.to) {
        const end = new Date(period.to);
        end.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, Date>).lte = end;
      }
    }
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, today, month, tokens] = await Promise.all([
      this.prisma.usageLog.aggregate({
        where,
        _sum: { realCost: true, userCost: true, margin: true, totalTokens: true },
      }),
      this.prisma.usageLog.aggregate({
        where: { ...where, createdAt: { gte: startOfDay } },
        _sum: { realCost: true, userCost: true, totalTokens: true },
      }),
      this.prisma.usageLog.aggregate({
        where: { ...where, createdAt: { gte: startOfMonth } },
        _sum: { realCost: true, userCost: true, totalTokens: true },
      }),
      this.prisma.usageLog.aggregate({
        where,
        _sum: { inputTokens: true, outputTokens: true, totalTokens: true },
      }),
    ]);

    const isAdmin = role === UserRole.ADMIN;
    const totalCost = Number(total._sum.userCost ?? 0);
    const realCost = Number(total._sum.realCost ?? 0);
    const margin = Number(total._sum.margin ?? 0);
    const income = margin || totalCost - realCost;
    const usdRubRate = isAdmin ? await this.exchange.getUsdRub() : undefined;

    return {
      balance: {
        totalCost,
        ...(isAdmin
          ? {
              realCost,
              margin,
              income,
              usdRubRate,
            }
          : {}),
        monthCost: Number(month._sum.userCost ?? 0),
        todayCost: Number(today._sum.userCost ?? 0),
      },
      tokens: {
        input: tokens._sum.inputTokens ?? 0,
        output: tokens._sum.outputTokens ?? 0,
        total: tokens._sum.totalTokens ?? 0,
      },
      view: isAdmin ? 'internal' : 'user',
    };
  }

  async getByModels(userId: string, role: string, apiKeyId?: string) {
    const where: Record<string, unknown> = role === UserRole.ADMIN ? {} : { userId };
    if (apiKeyId) where.apiKeyId = apiKeyId;
    const logs = await this.prisma.usageLog.groupBy({
      by: ['modelUsed'],
      where,
      _sum: { totalTokens: true, userCost: true, realCost: true },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });
    return logs.map((l) => ({
      model: l.modelUsed,
      requests: l._count.id,
      tokens: l._sum.totalTokens ?? 0,
      cost: Number(l._sum.userCost ?? 0),
      ...(role === UserRole.ADMIN && !apiKeyId
        ? { realCost: Number(l._sum.realCost ?? 0) }
        : {}),
    }));
  }

  async getDaily(userId: string, role: string, days = 30, apiKeyId?: string) {
    const where: Record<string, unknown> = role === UserRole.ADMIN ? {} : { userId };
    if (apiKeyId) where.apiKeyId = apiKeyId;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await this.prisma.usageLog.findMany({
      where: { ...where, createdAt: { gte: since } },
      select: {
        createdAt: true,
        totalTokens: true,
        userCost: true,
        realCost: true,
      },
    });

    const byDay = new Map<string, { tokens: number; cost: number; realCost: number; requests: number }>();
    for (const log of logs) {
      const day = log.createdAt.toISOString().split('T')[0];
      const entry = byDay.get(day) ?? { tokens: 0, cost: 0, realCost: 0, requests: 0 };
      entry.tokens += log.totalTokens;
      entry.cost += Number(log.userCost);
      if (role === UserRole.ADMIN) {
        entry.realCost += Number(log.realCost);
      }
      entry.requests += 1;
      byDay.set(day, entry);
    }

    return Array.from(byDay.entries()).map(([date, data]) => ({
      date,
      tokens: data.tokens,
      cost: data.cost,
      requests: data.requests,
      ...(role === UserRole.ADMIN
        ? {
            realCost: data.realCost,
            income: data.cost - data.realCost,
          }
        : {}),
    }));
  }

  async getMonthly(userId: string, role: string, months = 12, apiKeyId?: string) {
    const where: Record<string, unknown> = role === UserRole.ADMIN ? {} : { userId };
    if (apiKeyId) where.apiKeyId = apiKeyId;
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const logs = await this.prisma.usageLog.findMany({
      where: { ...where, createdAt: { gte: since } },
      select: { createdAt: true, totalTokens: true, userCost: true, realCost: true },
    });

    const byMonth = new Map<string, { tokens: number; cost: number; realCost: number; requests: number }>();
    for (const log of logs) {
      const month = log.createdAt.toISOString().slice(0, 7);
      const entry = byMonth.get(month) ?? { tokens: 0, cost: 0, realCost: 0, requests: 0 };
      entry.tokens += log.totalTokens;
      entry.cost += Number(log.userCost);
      if (role === UserRole.ADMIN && !apiKeyId) {
        entry.realCost += Number(log.realCost);
      }
      entry.requests += 1;
      byMonth.set(month, entry);
    }

    return Array.from(byMonth.entries()).map(([month, data]) => ({
      month,
      tokens: data.tokens,
      cost: data.cost,
      requests: data.requests,
      ...(role === UserRole.ADMIN && !apiKeyId ? { realCost: data.realCost } : {}),
    }));
  }

  async getByKeys(userId: string, role: string) {
    const where: Record<string, unknown> = role === UserRole.ADMIN ? {} : { userId };
    const groups = await this.prisma.usageLog.groupBy({
      by: ['apiKeyId'],
      where: { ...where, apiKeyId: { not: null } },
      _sum: { totalTokens: true, userCost: true, realCost: true },
      _count: { id: true },
    });

    const keys = await this.prisma.apiKey.findMany({
      where: { id: { in: groups.map((g) => g.apiKeyId!).filter(Boolean) } },
      select: { id: true, name: true, keyPrefix: true },
    });
    const keyMap = new Map(keys.map((k) => [k.id, k]));

    return groups.map((g) => ({
      apiKeyId: g.apiKeyId,
      name: keyMap.get(g.apiKeyId!)?.name,
      keyPrefix: keyMap.get(g.apiKeyId!)?.keyPrefix,
      requests: g._count.id,
      tokens: g._sum.totalTokens ?? 0,
      cost: Number(g._sum.userCost ?? 0),
      ...(role === UserRole.ADMIN
        ? { realCost: Number(g._sum.realCost ?? 0) }
        : {}),
    }));
  }

  async getLogs(
    userId: string,
    role: string,
    filters: {
      apiKeyId?: string;
      modelId?: string;
      agentId?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const where: Record<string, unknown> = role === UserRole.ADMIN ? {} : { userId };
    if (filters.apiKeyId) where.apiKeyId = filters.apiKeyId;
    if (filters.modelId) where.modelId = filters.modelId;
    if (filters.agentId) where.agentId = filters.agentId;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) (where.createdAt as Record<string, Date>).gte = new Date(filters.from);
      if (filters.to) (where.createdAt as Record<string, Date>).lte = new Date(filters.to);
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const [items, total] = await Promise.all([
      this.prisma.usageLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          apiKey: { select: { name: true, keyPrefix: true } },
          agent: { select: { name: true } },
          model: { select: { name: true } },
        },
      }),
      this.prisma.usageLog.count({ where }),
    ]);

    const isAdmin = role === UserRole.ADMIN;

    return serializeBigInts({
      data: items.map((log) => {
        const userCost = Number(log.userCost);
        const realCost = Number(log.realCost);
        const margin = Number(log.margin);
        return {
          ...log,
          userCost,
          realCost: isAdmin ? realCost : undefined,
          margin: isAdmin ? margin : undefined,
          income: isAdmin ? margin || userCost - realCost : undefined,
        };
      }),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  }

  /**
   * inputPrice/outputPrice — USD за 1M токенов (как в OpenRouter).
   * sell* — тариф клиента в ₽ за 1M токенов.
   */
  async calculateCosts(
    inputTokens: number,
    outputTokens: number,
    inputPriceUsdPerMillion: number,
    outputPriceUsdPerMillion: number,
    sellInputPriceRub?: number,
    sellOutputPriceRub?: number,
  ) {
    const rate = await this.exchange.getUsdRub();
    const realCost =
      calculateTokenCost(inputTokens, inputPriceUsdPerMillion * rate) +
      calculateTokenCost(outputTokens, outputPriceUsdPerMillion * rate);
    const userCost =
      calculateTokenCost(inputTokens, sellInputPriceRub ?? 0) +
      calculateTokenCost(outputTokens, sellOutputPriceRub ?? sellInputPriceRub ?? 0);
    return { realCost, userCost, margin: userCost - realCost, usdRubRate: rate };
  }

  /**
   * Пересчёт userCost по актуальным тарифам профилей (₽/1M токенов).
   */
  async recalculateBillingForKey(apiKeyId?: string) {
    const rate = await this.exchange.getUsdRub();
    const logs = await this.prisma.usageLog.findMany({
      where: {
        ...(apiKeyId ? { apiKeyId } : {}),
        status: { in: [RequestStatus.SUCCESS, RequestStatus.FALLBACK] },
      },
      include: { model: { select: { inputPrice: true, outputPrice: true } } },
    });

    if (!logs.length) return { updated: 0 };

    const userIds = [...new Set(logs.map((l) => l.userId))];
    const profilesByUser = new Map<
      string,
      Array<{
        slug: string;
        pricePerMillionRub: number;
        pricing: Array<{ sellPrice: number }>;
      }>
    >();

    for (const uid of userIds) {
      const rows = await this.prisma.keyModelProfile.findMany({
        where: { userId: uid },
        include: { pricing: { select: { sellPrice: true } } },
      });
      profilesByUser.set(
        uid,
        rows.map((p) => ({
          slug: p.slug,
          pricePerMillionRub: Number(p.pricePerMillionRub),
          pricing: p.pricing.map((pr) => ({ sellPrice: Number(pr.sellPrice) })),
        })),
      );
    }

    let updated = 0;
    for (const log of logs) {
      const profiles = profilesByUser.get(log.userId) ?? [];
      let slug = log.profileSlug ?? undefined;
      if (!slug) {
        slug = inferProfileSlugFromEffectiveRate(
          Number(log.userCost),
          log.inputTokens,
          log.outputTokens,
          profiles,
        );
      }

      const profile = profiles.find((p) => p.slug === slug);
      const sellPerMillion = profile?.pricePerMillionRub ?? 0;
      const userCost = computeUserCostRub(
        log.inputTokens,
        log.outputTokens,
        sellPerMillion,
      );

      let realCost = Number(log.realCost);
      if (log.model) {
        realCost =
          calculateTokenCost(log.inputTokens, Number(log.model.inputPrice) * rate) +
          calculateTokenCost(log.outputTokens, Number(log.model.outputPrice) * rate);
      }

      const margin = userCost - realCost;
      await this.prisma.usageLog.update({
        where: { id: log.id },
        data: {
          userCost,
          realCost,
          margin,
          profileSlug: slug,
        },
      });
      updated++;
    }

    const keyIds = apiKeyId
      ? [apiKeyId]
      : ([...new Set(logs.map((l) => l.apiKeyId).filter(Boolean))] as string[]);

    for (const kid of keyIds) {
      const agg = await this.prisma.usageLog.aggregate({
        where: {
          apiKeyId: kid,
          status: { in: [RequestStatus.SUCCESS, RequestStatus.FALLBACK] },
        },
        _sum: { userCost: true },
      });
      await this.prisma.apiKey.update({
        where: { id: kid },
        data: { spentRub: Number(agg._sum.userCost ?? 0) },
      });
    }

    return { updated, keysSynced: keyIds.length, usdRubRate: rate };
  }

  /** Пересчёт себестоимости в ₽ для существующих записей (после смены курса / синка). */
  async recalculateAllLogCosts() {
    const rate = await this.exchange.getUsdRub();
    const logs = await this.prisma.usageLog.findMany({
      where: { modelId: { not: null } },
      include: {
        model: { select: { inputPrice: true, outputPrice: true } },
      },
    });

    let updated = 0;
    for (const log of logs) {
      if (!log.model) continue;
      const realCost =
        calculateTokenCost(log.inputTokens, Number(log.model.inputPrice) * rate) +
        calculateTokenCost(log.outputTokens, Number(log.model.outputPrice) * rate);
      const userCost = Number(log.userCost);
      const margin = userCost - realCost;
      await this.prisma.usageLog.update({
        where: { id: log.id },
        data: { realCost, margin },
      });
      updated++;
    }
    return { updated, usdRubRate: rate };
  }
}
