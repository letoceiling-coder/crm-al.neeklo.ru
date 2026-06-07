import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-keys.dto';
import {
  generateApiKey,
  hashApiKey,
  encryptApiKey,
  decryptApiKey,
  calculateMargin,
  calculateTokenCost,
} from '../common/utils/crypto.util';
import { serializeBigInts, stripApiKeySecrets } from '../common/utils/serialize.util';
import { OPENROUTER_AUTO_MODEL_ID } from '../common/constants';
import {
  AuditAction,
  ApiKeyTopUpType,
  ApiKeyStatus,
  KeyRoutingMode,
  Prisma,
  RequestStatus,
  UserRole,
} from '@prisma/client';

const profileInclude = {
  chains: {
    orderBy: { priority: 'asc' as const },
    include: { model: true },
  },
  pricing: { include: { model: true } },
};

@Injectable()
export class ApiKeysService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAllForUser(userId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        modelChain: {
          orderBy: { priority: 'asc' },
          include: { model: { select: { id: true, name: true, openrouterId: true } } },
        },
        pricing: {
          include: { model: { select: { id: true, name: true } } },
        },
        modelProfile: {
          select: { id: true, name: true, slug: true, pricePerMillionRub: true },
        },
      },
    });
    return serializeBigInts(keys.map((k) => stripApiKeySecrets(k)));
  }

  async findAllAdmin() {
    const keys = await this.prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true } },
        modelChain: {
          orderBy: { priority: 'asc' },
          include: { model: { select: { id: true, name: true } } },
        },
      },
    });
    return serializeBigInts(keys.map((k) => stripApiKeySecrets(k)));
  }

  async findOne(id: string, userId: string, role: UserRole) {
    const key = await this.prisma.apiKey.findUnique({
      where: { id },
      include: {
        modelChain: {
          orderBy: { priority: 'asc' },
          include: { model: true },
        },
        pricing: { include: { model: true } },
        modelProfile: {
          include: {
            chains: { orderBy: { priority: 'asc' }, include: { model: true } },
            pricing: { include: { model: true } },
          },
        },
      },
    });
    if (!key) throw new NotFoundException('API key not found');
    if (role !== UserRole.ADMIN && key.userId !== userId) {
      throw new ForbiddenException();
    }
    return serializeBigInts(stripApiKeySecrets(key));
  }

  async revealKey(id: string, userId: string, role: UserRole) {
    const key = await this.prisma.apiKey.findUnique({
      where: { id },
      select: { id: true, userId: true, keyEncrypted: true, keyPrefix: true },
    });
    if (!key) throw new NotFoundException('API key not found');
    if (role !== UserRole.ADMIN && key.userId !== userId) {
      throw new ForbiddenException();
    }
    if (!key.keyEncrypted) {
      throw new BadRequestException(
        'Полный ключ недоступен для этого ключа. Нажмите «Регенерировать» — новый ключ сохранится для копирования.',
      );
    }
    return { key: decryptApiKey(key.keyEncrypted) };
  }

  async create(userId: string, dto: CreateApiKeyDto) {
    const { key, prefix, hash } = generateApiKey();
    const useProfile = dto.routingMode !== 'custom';
    const hasCustomChain = (dto.modelChain?.length ?? 0) > 0;

    let modelProfileId: string | null = null;
    let pricePerMillionRub = dto.pricePerMillionRub ?? 0;
    let routingMode: KeyRoutingMode = KeyRoutingMode.CUSTOM;

    if (useProfile && dto.modelProfileId) {
      const profile = await this.prisma.keyModelProfile.findFirst({
        where: { id: dto.modelProfileId, userId, isActive: true },
      });
      if (!profile) throw new NotFoundException('Профиль модели не найден');
      modelProfileId = profile.id;
      routingMode = KeyRoutingMode.PROFILE;
      if (!dto.pricePerMillionRub) {
        pricePerMillionRub = Number(profile.pricePerMillionRub);
      }
    } else if (!hasCustomChain) {
      const auto = await this.getDefaultAutoProfile(userId);
      if (auto) {
        modelProfileId = auto.id;
        routingMode = KeyRoutingMode.PROFILE;
        if (!dto.pricePerMillionRub) {
          pricePerMillionRub = Number(auto.pricePerMillionRub);
        }
      }
    }

    const apiKey = await this.prisma.$transaction(async (tx) => {
      const created = await tx.apiKey.create({
        data: {
          userId,
          name: dto.name,
          keyHash: hash,
          keyEncrypted: encryptApiKey(key),
          keyPrefix: prefix,
          comment: dto.comment,
          allowedIps: dto.allowedIps ?? [],
          allowedDomains: dto.allowedDomains ?? [],
          balanceRub: dto.balanceRub ?? 0,
          pricePerMillionRub,
          routingMode,
          modelProfileId,
        },
      });

      if (routingMode === KeyRoutingMode.CUSTOM && dto.modelChain?.length) {
        await tx.apiKeyModelChain.createMany({
          data: dto.modelChain.map((m) => ({
            apiKeyId: created.id,
            modelId: m.modelId,
            priority: m.priority,
          })),
        });
      }

      if (routingMode === KeyRoutingMode.CUSTOM && dto.pricing?.length) {
        await tx.apiKeyPricing.createMany({
          data: dto.pricing.map((p) => ({
            apiKeyId: created.id,
            modelId: p.modelId,
            costPrice: p.costPrice,
            sellPrice: p.sellPrice,
            margin: calculateMargin(p.costPrice, p.sellPrice),
          })),
        });
      }

      return created;
    });

    await this.syncBalanceStatus(apiKey.id);

    const initialBalance = dto.balanceRub ?? 0;
    if (initialBalance > 0) {
      await this.prisma.apiKeyTopUp.create({
        data: {
          apiKeyId: apiKey.id,
          userId,
          amountRub: initialBalance,
          balanceBefore: 0,
          balanceAfter: initialBalance,
          type: ApiKeyTopUpType.INITIAL,
          comment: 'Начальный баланс при создании ключа',
        },
      });
    }

    await this.audit.log(AuditAction.API_KEY_CREATED, userId, {
      apiKeyId: apiKey.id,
      name: apiKey.name,
    });

    return serializeBigInts({ ...stripApiKeySecrets(apiKey), key });
  }

  async update(id: string, userId: string, role: UserRole, dto: UpdateApiKeyDto) {
    await this.findOne(id, userId, role);

    const useProfile = dto.routingMode === 'profile';
    let routingMode: KeyRoutingMode | undefined;
    let modelProfileId: string | null | undefined;

    if (dto.routingMode !== undefined) {
      if (useProfile) {
        let profileId = dto.modelProfileId;
        if (!profileId) {
          const auto = await this.getDefaultAutoProfile(userId);
          if (!auto) {
            throw new BadRequestException(
              'Создайте профиль auto в разделе «Модели для ключей» или выберите другой профиль',
            );
          }
          profileId = auto.id;
        }
        const profile = await this.prisma.keyModelProfile.findFirst({
          where: { id: profileId, userId, isActive: true },
        });
        if (!profile) throw new NotFoundException('Профиль модели не найден');
        routingMode = KeyRoutingMode.PROFILE;
        modelProfileId = profile.id;
      } else {
        routingMode = KeyRoutingMode.CUSTOM;
        modelProfileId = null;
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.apiKey.update({
        where: { id },
        data: {
          name: dto.name,
          comment: dto.comment,
          allowedIps: dto.allowedIps,
          allowedDomains: dto.allowedDomains,
          pricePerMillionRub: dto.pricePerMillionRub,
          ...(routingMode !== undefined ? { routingMode } : {}),
          ...(modelProfileId !== undefined ? { modelProfileId } : {}),
        },
      });

      if (routingMode === KeyRoutingMode.PROFILE) {
        await tx.apiKeyModelChain.deleteMany({ where: { apiKeyId: id } });
        await tx.apiKeyPricing.deleteMany({ where: { apiKeyId: id } });
      }

      if (routingMode === KeyRoutingMode.CUSTOM || dto.modelChain) {
        if (dto.modelChain) {
          await tx.apiKeyModelChain.deleteMany({ where: { apiKeyId: id } });
          if (dto.modelChain.length) {
            await tx.apiKeyModelChain.createMany({
              data: dto.modelChain.map((m) => ({
                apiKeyId: id,
                modelId: m.modelId,
                priority: m.priority,
              })),
            });
          }
        }
      }

      if (routingMode === KeyRoutingMode.CUSTOM && dto.pricing) {
        await tx.apiKeyPricing.deleteMany({ where: { apiKeyId: id } });
        if (dto.pricing.length) {
          await tx.apiKeyPricing.createMany({
            data: dto.pricing.map((p) => ({
              apiKeyId: id,
              modelId: p.modelId,
              costPrice: p.costPrice,
              sellPrice: p.sellPrice,
              margin: calculateMargin(p.costPrice, p.sellPrice),
            })),
          });
        }
      }
    });

    if (dto.pricing !== undefined || dto.pricePerMillionRub !== undefined) {
      await this.recalculateSpent(id);
    }
    await this.syncBalanceStatus(id);

    await this.audit.log(AuditAction.API_KEY_UPDATED, userId, { apiKeyId: id });
    return this.findOne(id, userId, role);
  }

  async deactivate(id: string, userId: string, role: UserRole) {
    await this.findOne(id, userId, role);
    await this.prisma.apiKey.update({
      where: { id },
      data: { status: ApiKeyStatus.INACTIVE },
    });
    await this.audit.log(AuditAction.API_KEY_DEACTIVATED, userId, { apiKeyId: id });
    return { deactivated: true };
  }

  async regenerate(id: string, userId: string, role: UserRole) {
    await this.findOne(id, userId, role);
    const { key, prefix, hash } = generateApiKey();
    await this.prisma.apiKey.update({
      where: { id },
      data: {
        keyHash: hash,
        keyEncrypted: encryptApiKey(key),
        keyPrefix: prefix,
        status: ApiKeyStatus.ACTIVE,
      },
    });
    await this.audit.log(AuditAction.API_KEY_REGENERATED, userId, { apiKeyId: id });
    return { key, prefix };
  }

  async validateKey(rawKey: string) {
    const hash = hashApiKey(rawKey);
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash: hash },
      include: {
        user: true,
        modelChain: {
          orderBy: { priority: 'asc' },
          include: { model: true },
        },
        pricing: { include: { model: true } },
        modelProfile: {
          include: {
            chains: { orderBy: { priority: 'asc' }, include: { model: true } },
            pricing: true,
          },
        },
      },
    });

    if (!apiKey || apiKey.status !== ApiKeyStatus.ACTIVE) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    return apiKey;
  }

  async getDefaultAutoProfile(userId: string) {
    return this.prisma.keyModelProfile.findFirst({
      where: { userId, slug: 'auto', isActive: true },
      include: profileInclude,
    });
  }

  /** Ключ без профиля и без своей цепочки → профиль auto по умолчанию. */
  async enrichKeyForRouting<
    T extends {
      userId: string;
      modelProfileId: string | null;
      routingMode: KeyRoutingMode;
      pricePerMillionRub: Prisma.Decimal;
      modelChain: unknown[];
      modelProfile?: Prisma.KeyModelProfileGetPayload<{
        include: typeof profileInclude;
      }> | null;
    },
  >(key: T) {
    const hasExplicit =
      key.modelProfileId != null || (key.modelChain?.length ?? 0) > 0;
    if (hasExplicit) return key;

    const auto = await this.getDefaultAutoProfile(key.userId);
    if (!auto) return key;

    const pricePerMillionRub =
      Number(key.pricePerMillionRub) > 0
        ? key.pricePerMillionRub
        : auto.pricePerMillionRub;

    return {
      ...key,
      routingMode: KeyRoutingMode.PROFILE,
      modelProfileId: auto.id,
      modelProfile: auto,
      pricePerMillionRub,
    };
  }

  async getKeyForRouting(apiKeyId: string) {
    const key = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      include: {
        modelProfile: { include: profileInclude },
        modelChain: { orderBy: { priority: 'asc' }, include: { model: true } },
        pricing: { include: { model: true } },
      },
    });
    if (!key) throw new NotFoundException('API key not found');
    return this.enrichKeyForRouting(key);
  }

  async syncBalanceStatus(apiKeyId: string) {
    const snap = await this.getBalanceSnapshot(apiKeyId);
    if (snap.isExhausted) {
      await this.prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { status: ApiKeyStatus.BLOCKED },
      });
      return;
    }
    const key = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { status: true },
    });
    if (key?.status === ApiKeyStatus.BLOCKED) {
      await this.prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { status: ApiKeyStatus.ACTIVE },
      });
    }
  }

  async getBalanceSnapshot(apiKeyId: string) {
    const key = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { balanceRub: true, spentRub: true },
    });
    if (!key) throw new NotFoundException('API key not found');

    const balanceRub = Number(key.balanceRub);
    const spentRub = Number(key.spentRub);
    const remainingRub = balanceRub - spentRub;

    return {
      currency: 'RUB' as const,
      balanceRub,
      spentRub,
      remainingRub,
      percentUsed: balanceRub > 0 ? (spentRub / balanceRub) * 100 : 0,
      isExhausted: balanceRub > 0 && remainingRub <= 0,
      isOverdrawn: balanceRub > 0 && remainingRub < 0,
      unlimited: balanceRub <= 0,
    };
  }

  /** Пересчёт расхода по логам с актуальными sellPrice из настроек ключа. */
  async recalculateSpent(apiKeyId: string) {
    const spentRub = await this.sumSpentFromLogs(apiKeyId);
    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { spentRub },
    });
    await this.syncBalanceStatus(apiKeyId);
    return spentRub;
  }

  async getBalance(apiKeyId: string, userId: string, role: UserRole) {
    const key = await this.findOne(apiKeyId, userId, role);
    await this.recalculateSpent(apiKeyId);
    const snapshot = await this.getBalanceSnapshot(apiKeyId);
    return {
      apiKeyId,
      name: key.name,
      keyPrefix: key.keyPrefix,
      defaultModel: 'auto',
      ...snapshot,
    };
  }

  async topUp(
    id: string,
    userId: string,
    role: UserRole,
    amountRub: number,
    comment?: string,
  ) {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException('API key not found');
    if (role !== UserRole.ADMIN && key.userId !== userId) {
      throw new ForbiddenException();
    }

    const before = Number(key.balanceRub);
    const after = before + amountRub;

    await this.prisma.$transaction([
      this.prisma.apiKey.update({
        where: { id },
        data: { balanceRub: after },
      }),
      this.prisma.apiKeyTopUp.create({
        data: {
          apiKeyId: id,
          userId,
          amountRub,
          balanceBefore: before,
          balanceAfter: after,
          type: ApiKeyTopUpType.TOP_UP,
          comment,
        },
      }),
    ]);

    await this.recalculateSpent(id);
    await this.syncBalanceStatus(id);
    try {
      await this.audit.log(AuditAction.API_KEY_TOP_UP, userId, {
        apiKeyId: id,
        amountRub,
      });
    } catch {
      /* audit enum may lag migration — top-up already committed */
    }

    return this.getBalance(id, userId, role);
  }

  async listTopUps(
    userId: string,
    role: UserRole,
    query: {
      apiKeyId?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Prisma.ApiKeyTopUpWhereInput = {};

    if (role !== UserRole.ADMIN) {
      where.apiKey = { userId };
    }
    if (query.apiKeyId) {
      if (role !== UserRole.ADMIN) {
        const owned = await this.prisma.apiKey.findFirst({
          where: { id: query.apiKeyId, userId },
        });
        if (!owned) throw new ForbiddenException();
      }
      where.apiKeyId = query.apiKeyId;
    }
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const [items, total] = await Promise.all([
      this.prisma.apiKeyTopUp.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          apiKey: { select: { id: true, name: true, keyPrefix: true } },
        },
      }),
      this.prisma.apiKeyTopUp.count({ where }),
    ]);

    return {
      data: serializeBigInts(items),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTopUpStats(
    userId: string,
    role: UserRole,
    query: { apiKeyId?: string; from?: string; to?: string },
  ) {
    const where: Prisma.ApiKeyTopUpWhereInput = {};
    if (role !== UserRole.ADMIN) {
      where.apiKey = { userId };
    }
    if (query.apiKeyId) {
      if (role !== UserRole.ADMIN) {
        const owned = await this.prisma.apiKey.findFirst({
          where: { id: query.apiKeyId, userId },
        });
        if (!owned) throw new ForbiddenException();
      }
      where.apiKeyId = query.apiKeyId;
    }
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const agg = await this.prisma.apiKeyTopUp.aggregate({
      where,
      _sum: { amountRub: true },
      _count: true,
    });

    const byKey = await this.prisma.apiKeyTopUp.groupBy({
      by: ['apiKeyId'],
      where,
      _sum: { amountRub: true },
      _count: true,
    });

    const keys = await this.prisma.apiKey.findMany({
      where: { id: { in: byKey.map((b) => b.apiKeyId) } },
      select: { id: true, name: true, keyPrefix: true },
    });
    const keyMap = new Map(keys.map((k) => [k.id, k]));

    return {
      totalTopUpRub: Number(agg._sum.amountRub ?? 0),
      topUpCount: agg._count,
      byApiKey: byKey.map((b) => ({
        apiKeyId: b.apiKeyId,
        name: keyMap.get(b.apiKeyId)?.name,
        keyPrefix: keyMap.get(b.apiKeyId)?.keyPrefix,
        totalRub: Number(b._sum.amountRub ?? 0),
        count: b._count,
      })),
    };
  }

  /** @deprecated Используйте topUp — начисление с историей */
  async setBalance(id: string, userId: string, role: UserRole, balanceRub: number) {
    const snap = await this.getBalanceSnapshot(id);
    const delta = balanceRub - Number(snap.balanceRub);
    if (delta <= 0) {
      throw new BadRequestException(
        'Установка баланса ниже начисленного недоступна. Используйте пополнение.',
      );
    }
    return this.topUp(id, userId, role, delta, 'Корректировка через setBalance');
  }

  async getBalanceForApiKey(apiKeyId: string) {
    await this.recalculateSpent(apiKeyId);
    const key = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { name: true, keyPrefix: true },
    });
    if (!key) throw new NotFoundException('API key not found');
    const snapshot = await this.getBalanceSnapshot(apiKeyId);
    return {
      apiKeyId,
      name: key.name,
      keyPrefix: key.keyPrefix,
      defaultModel: 'auto',
      ...snapshot,
    };
  }

  private async sumSpentFromLogs(apiKeyId: string) {
    const agg = await this.prisma.usageLog.aggregate({
      where: {
        apiKeyId,
        status: { in: [RequestStatus.SUCCESS, RequestStatus.FALLBACK] },
      },
      _sum: { userCost: true },
    });
    return Number(agg._sum.userCost ?? 0);
  }

  /** @deprecated Используйте sumSpentFromLogs; оставлено для совместимости внутренних вызовов */
  private async computeSpentFromLogs(apiKeyId: string) {
    const raw = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      include: {
        pricing: true,
        modelProfile: { include: profileInclude },
        modelChain: true,
      },
    });
    if (!raw) return 0;
    const apiKey = await this.enrichKeyForRouting(raw);

    const logs = await this.prisma.usageLog.findMany({
      where: {
        apiKeyId,
        status: { in: [RequestStatus.SUCCESS, RequestStatus.FALLBACK] },
      },
      select: {
        inputTokens: true,
        outputTokens: true,
        modelId: true,
        userCost: true,
      },
    });

    if (!logs.length) return 0;

    const modelIds = [...new Set(logs.map((l) => l.modelId).filter(Boolean))] as string[];
    const models = modelIds.length
      ? await this.prisma.model.findMany({ where: { id: { in: modelIds } } })
      : [];
    const modelMap = new Map(models.map((m) => [m.id, m]));

    const defaultSell = Number(apiKey.pricePerMillionRub);
    let spent = 0;
    for (const log of logs) {
      const loggedCost = Number(log.userCost);
      if (loggedCost > 0) {
        spent += loggedCost;
        continue;
      }
      if (log.modelId && modelMap.has(log.modelId)) {
        const model = modelMap.get(log.modelId)!;
        const pricing =
          apiKey.routingMode === KeyRoutingMode.PROFILE && apiKey.modelProfile
            ? apiKey.modelProfile.pricing.find((p) => p.modelId === log.modelId)
            : apiKey.pricing.find((p) => p.modelId === log.modelId);
        const profileDefault =
          apiKey.routingMode === KeyRoutingMode.PROFILE && apiKey.modelProfile
            ? Number(apiKey.modelProfile.pricePerMillionRub)
            : 0;
        const sell = pricing
          ? Number(pricing.sellPrice)
          : profileDefault > 0
            ? profileDefault
            : defaultSell > 0
              ? defaultSell
              : Number(model.inputPrice);
        spent +=
          calculateTokenCost(log.inputTokens, sell) +
          calculateTokenCost(log.outputTokens, sell);
      } else {
        const total = log.inputTokens + log.outputTokens;
        spent +=
          defaultSell > 0
            ? calculateTokenCost(total, defaultSell)
            : Number(log.userCost);
      }
    }
    return spent;
  }

  async ensureAutoModel() {
    const existing = await this.prisma.model.findUnique({
      where: { openrouterId: OPENROUTER_AUTO_MODEL_ID },
    });
    if (existing) return existing;

    return this.prisma.model.create({
      data: {
        openrouterId: OPENROUTER_AUTO_MODEL_ID,
        name: 'Auto (OpenRouter)',
        provider: 'openrouter',
        description:
          'Автоматический выбор модели OpenRouter. Используется по умолчанию для API-ключей.',
        contextLength: 128000,
        inputPrice: 0,
        outputPrice: 0,
        isEnabled: true,
        isFree: false,
        labels: [],
      },
    });
  }

  async getStats(userId: string) {
    const keys = await this.prisma.apiKey.findMany({ where: { userId } });
    return {
      active: keys.filter((k) => k.status === ApiKeyStatus.ACTIVE).length,
      blocked: keys.filter((k) => k.status === ApiKeyStatus.BLOCKED).length,
      limitExceeded: keys.filter((k) => k.status === ApiKeyStatus.BLOCKED).length,
      inactive: keys.filter((k) => k.status === ApiKeyStatus.INACTIVE).length,
      total: keys.length,
    };
  }
}
