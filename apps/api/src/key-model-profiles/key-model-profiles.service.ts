import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { apiHttpException } from '../common/api-error.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateKeyModelProfileDto,
  UpdateKeyModelProfileDto,
} from './dto/key-model-profiles.dto';
import { slugify } from '../common/utils/slug.util';
import { calculateMargin, calculateTokenCost } from '../common/utils/crypto.util';
import { resolveProfileSellPriceRub } from '../common/utils/billing.util';
import { serializeBigInts } from '../common/utils/serialize.util';
import { OPENROUTER_AUTO_MODEL_ID } from '../common/constants';

/** Профили, доступные в параметре model любого ключа владельца. */
export const API_MODEL_PROFILE_SLUGS = ['auto', 'aura', 'neeklo'] as const;
import {
  KeyRoutingMode,
  Model,
  Prisma,
  UserRole,
} from '@prisma/client';

export type ApiKeyWithRouting = Prisma.ApiKeyGetPayload<{
  include: {
    modelProfile: {
      include: {
        chains: { orderBy: { priority: 'asc' }; include: { model: true } };
        pricing: { include: { model: true } };
      };
    };
    modelChain: { orderBy: { priority: 'asc' }; include: { model: true } };
    pricing: { include: { model: true } };
  };
}>;

@Injectable()
export class KeyModelProfilesService {
  constructor(private prisma: PrismaService) {}

  private profileInclude = {
    chains: {
      orderBy: { priority: 'asc' as const },
      include: { model: { select: { id: true, name: true, openrouterId: true, provider: true, isFree: true } } },
    },
    pricing: { include: { model: { select: { id: true, name: true } } } },
  };

  private readonly routingProfileInclude = {
    chains: { orderBy: { priority: 'asc' as const }, include: { model: true } },
    pricing: true,
  };

  async findAllForUser(userId: string) {
    const items = await this.prisma.keyModelProfile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: this.profileInclude,
    });
    return items.map((p) => this.serializeProfile(p));
  }

  async findOne(id: string, userId: string, role: UserRole) {
    const profile = await this.prisma.keyModelProfile.findUnique({
      where: { id },
      include: this.profileInclude,
    });
    if (!profile) throw new NotFoundException('Profile not found');
    if (role !== UserRole.ADMIN && profile.userId !== userId) {
      throw new ForbiddenException();
    }
    return this.serializeProfile(profile);
  }

  async findBySlug(slug: string, userId: string) {
    return this.prisma.keyModelProfile.findUnique({
      where: { userId_slug: { userId, slug } },
      include: {
        chains: { orderBy: { priority: 'asc' }, include: { model: true } },
        pricing: true,
      },
    });
  }

  async create(userId: string, dto: CreateKeyModelProfileDto) {
    if (!dto.modelChain?.length) {
      throw new BadRequestException('Добавьте хотя бы одну модель в цепочку');
    }
    const slug = dto.slug?.trim() || slugify(dto.name);
    await this.ensureUniqueSlug(userId, slug);

    const profile = await this.prisma.$transaction(async (tx) => {
      const created = await tx.keyModelProfile.create({
        data: {
          userId,
          name: dto.name,
          slug,
          description: dto.description,
          pricePerMillionRub: dto.pricePerMillionRub,
        },
      });

      await tx.keyModelProfileChain.createMany({
        data: dto.modelChain.map((m, i) => ({
          profileId: created.id,
          modelId: m.modelId,
          priority: m.priority ?? i,
        })),
      });

      const pricing = dto.pricing?.length
        ? dto.pricing
        : await this.buildDefaultPricing(dto.modelChain, dto.pricePerMillionRub);

      if (pricing.length) {
        await tx.keyModelProfilePricing.createMany({
          data: pricing.map((p) => ({
            profileId: created.id,
            modelId: p.modelId,
            costPrice: p.costPrice,
            sellPrice: p.sellPrice,
            margin: calculateMargin(p.costPrice, p.sellPrice),
          })),
        });
      }

      return created;
    });

    return this.findOne(profile.id, userId, UserRole.USER);
  }

  async update(id: string, userId: string, role: UserRole, dto: UpdateKeyModelProfileDto) {
    const existing = await this.findOne(id, userId, role);

    if (dto.slug && dto.slug !== existing.slug) {
      await this.ensureUniqueSlug(existing.userId as string, dto.slug, id);
    }

    if (dto.pricePerMillionRub != null && dto.pricing?.length) {
      dto.pricing = dto.pricing.map((p) => ({
        ...p,
        sellPrice: dto.pricePerMillionRub!,
      }));
    } else if (
      dto.pricePerMillionRub != null &&
      dto.modelChain?.length &&
      !dto.pricing?.length
    ) {
      dto.pricing = await this.buildDefaultPricing(
        dto.modelChain,
        dto.pricePerMillionRub,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.keyModelProfile.update({
        where: { id },
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          pricePerMillionRub: dto.pricePerMillionRub,
          isActive: dto.isActive,
        },
      });

      if (dto.modelChain) {
        await tx.keyModelProfileChain.deleteMany({ where: { profileId: id } });
        if (dto.modelChain.length) {
          await tx.keyModelProfileChain.createMany({
            data: dto.modelChain.map((m, i) => ({
              profileId: id,
              modelId: m.modelId,
              priority: m.priority ?? i,
            })),
          });
        }
      }

      if (dto.pricing) {
        await tx.keyModelProfilePricing.deleteMany({ where: { profileId: id } });
        if (dto.pricing.length) {
          await tx.keyModelProfilePricing.createMany({
            data: dto.pricing.map((p) => ({
              profileId: id,
              modelId: p.modelId,
              costPrice: p.costPrice,
              sellPrice: p.sellPrice,
              margin: calculateMargin(p.costPrice, p.sellPrice),
            })),
          });
        }
      } else if (dto.pricePerMillionRub != null) {
        const rows = await tx.keyModelProfilePricing.findMany({
          where: { profileId: id },
        });
        for (const row of rows) {
          const sell = dto.pricePerMillionRub;
          await tx.keyModelProfilePricing.update({
            where: { id: row.id },
            data: {
              sellPrice: sell,
              margin: calculateMargin(Number(row.costPrice), sell),
            },
          });
        }
      }
    });

    return this.findOne(id, userId, role);
  }

  async remove(id: string, userId: string, role: UserRole) {
    await this.findOne(id, userId, role);
    const used = await this.prisma.apiKey.count({ where: { modelProfileId: id } });
    if (used > 0) {
      throw new BadRequestException('Профиль используется API-ключами');
    }
    await this.prisma.keyModelProfile.delete({ where: { id } });
    return { deleted: true };
  }

  getChainModels(apiKey: ApiKeyWithRouting): Model[] {
    if (apiKey.routingMode === KeyRoutingMode.PROFILE && apiKey.modelProfile) {
      return apiKey.modelProfile.chains.map((c) => c.model).filter(Boolean);
    }
    return apiKey.modelChain.map((c) => c.model).filter(Boolean);
  }

  resolveSellPrice(
    apiKey: ApiKeyWithRouting,
    modelId: string,
    modelInputPrice: number,
    activeProfile?: {
      pricePerMillionRub: Prisma.Decimal;
      pricing: Array<{ modelId: string; sellPrice: Prisma.Decimal }>;
    } | null,
  ): number {
    if (activeProfile) {
      const perModel = activeProfile.pricing.find((p) => p.modelId === modelId);
      return resolveProfileSellPriceRub(
        Number(activeProfile.pricePerMillionRub),
        perModel ? Number(perModel.sellPrice) : undefined,
      );
    }
    if (apiKey.routingMode === KeyRoutingMode.PROFILE && apiKey.modelProfile) {
      const perModel = apiKey.modelProfile.pricing.find((p) => p.modelId === modelId);
      return resolveProfileSellPriceRub(
        Number(apiKey.modelProfile.pricePerMillionRub),
        perModel ? Number(perModel.sellPrice) : undefined,
      );
    }
    const pricing = apiKey.pricing.find((p) => p.modelId === modelId);
    if (pricing) return Number(pricing.sellPrice);
    const keyDefault = Number(apiKey.pricePerMillionRub);
    if (keyDefault > 0) return keyDefault;
    return modelInputPrice;
  }

  async getSellPriceForProfileSlug(userId: string, slug: string): Promise<number> {
    const profile = await this.loadProfileBySlug(userId, slug);
    if (!profile) return 0;
    return Number(profile.pricePerMillionRub);
  }

  async getFallbackChain(): Promise<Model[]> {
    const globalFallback = await this.prisma.globalFallbackChain.findMany({
      orderBy: { priority: 'asc' },
      include: { model: true },
    });
    return globalFallback.map((g) => g.model);
  }

  private async loadProfileBySlug(userId: string, slug: string) {
    return this.prisma.keyModelProfile.findFirst({
      where: { userId, slug, isActive: true },
      include: this.routingProfileInclude,
    });
  }

  /** Профиль из параметра model (не привязан к настройкам ключа). */
  async resolveRequestProfile(
    apiKey: ApiKeyWithRouting,
    requestedModel?: string,
  ) {
    const trimmed = (requestedModel ?? '').trim();
    const lower = trimmed.toLowerCase();
    const isAuto =
      !trimmed ||
      lower === 'auto' ||
      lower === OPENROUTER_AUTO_MODEL_ID.toLowerCase();
    const slug = isAuto
      ? 'auto'
      : trimmed.replace(/^profile:/i, '').trim().toLowerCase();
    return this.loadProfileBySlug(apiKey.userId, slug);
  }

  async resolveModelsForRequest(
    apiKey: ApiKeyWithRouting,
    requestedModel: string,
    ensureAutoModel: () => Promise<Model>,
  ): Promise<{ models: Model[]; profile: Awaited<ReturnType<typeof this.loadProfileBySlug>> }> {
    const normalized = (requestedModel ?? '').trim().toLowerCase();
    const profile = await this.resolveRequestProfile(apiKey, requestedModel);

    if (profile?.chains.length) {
      return {
        models: profile.chains
          .map((c) => c.model)
          .filter((m) => m && m.isEnabled),
        profile,
      };
    }

    const useAuto =
      !normalized ||
      normalized === 'auto' ||
      normalized === OPENROUTER_AUTO_MODEL_ID.toLowerCase();

    if (useAuto) {
      const auto = await ensureAutoModel();
      const chain = this.getChainModels(apiKey);
      const fallback =
        chain.length > 0 ? chain : await this.getFallbackChain();
      const result: Model[] = [auto];
      const seen = new Set<string>([auto.id]);
      for (const m of fallback) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          result.push(m);
        }
      }
      return { models: result, profile: profile ?? null };
    }

    if (profile && !profile.chains.length) {
      apiHttpException(
        HttpStatus.BAD_REQUEST,
        'PROFILE_EMPTY',
        `Профиль «${profile.slug}» не содержит моделей. Настройте цепочку в панели.`,
        'Bad Request',
      );
    }

    const slug = normalized.replace(/^profile:/i, '');
    if (API_MODEL_PROFILE_SLUGS.includes(slug as (typeof API_MODEL_PROFILE_SLUGS)[number])) {
      apiHttpException(
        HttpStatus.BAD_REQUEST,
        'PROFILE_NOT_FOUND',
        `Профиль «${slug}» не найден. Создайте его в разделе «Модели для ключей».`,
        'Bad Request',
      );
    }

    const explicit = await this.prisma.model.findFirst({
      where: {
        isEnabled: true,
        OR: [
          { openrouterId: requestedModel },
          { id: requestedModel },
          { openrouterId: { equals: requestedModel, mode: 'insensitive' } },
        ],
      },
    });

    if (explicit && this.isModelAllowed(apiKey, explicit, profile)) {
      return { models: [explicit], profile };
    }

    apiHttpException(
      HttpStatus.BAD_REQUEST,
      'MODEL_NOT_AVAILABLE',
      `Модель «${requestedModel}» недоступна. Укажите auto, aura или neeklo — см. GET /api/v1/models`,
      'Bad Request',
    );
  }

  isModelAllowed(
    apiKey: ApiKeyWithRouting,
    model: Model,
    activeProfile?: { chains: Array<{ modelId: string }> } | null,
  ): boolean {
    if (activeProfile?.chains.some((c) => c.modelId === model.id)) return true;
    const allowed = this.getChainModels(apiKey);
    if (allowed.some((m) => m.id === model.id)) return true;
    if (model.openrouterId === OPENROUTER_AUTO_MODEL_ID) return true;
    return false;
  }

  async getDefaultAutoProfileForUser(userId: string) {
    return this.loadProfileBySlug(userId, 'auto');
  }

  async listAvailableModels(apiKey: ApiKeyWithRouting) {
    const items: Array<Record<string, unknown>> = [];

    const profiles = await this.prisma.keyModelProfile.findMany({
      where: { userId: apiKey.userId, isActive: true },
      include: this.routingProfileInclude,
    });

    const slugOrder = [...API_MODEL_PROFILE_SLUGS];
    profiles.sort((a, b) => {
      const ia = slugOrder.indexOf(a.slug as (typeof API_MODEL_PROFILE_SLUGS)[number]);
      const ib = slugOrder.indexOf(b.slug as (typeof API_MODEL_PROFILE_SLUGS)[number]);
      const ao = ia === -1 ? 99 : ia;
      const bo = ib === -1 ? 99 : ib;
      return ao - bo || a.name.localeCompare(b.name);
    });

    const seenSlugs = new Set<string>();
    for (const p of profiles) {
      seenSlugs.add(p.slug);
      items.push({
        id: p.slug,
        type: 'profile',
        profileId: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        pricePerMillionRub: Number(p.pricePerMillionRub),
        modelChain: p.chains.map((c, i) => ({
          priority: i + 1,
          modelId: c.modelId,
          name: c.model.name,
          openrouterId: c.model.openrouterId,
          isFree: c.model.isFree,
        })),
      });
    }

    if (!seenSlugs.has('auto')) {
      items.unshift({
        id: 'auto',
        type: 'auto',
        name: 'Auto (OpenRouter)',
        slug: 'auto',
        openrouterId: OPENROUTER_AUTO_MODEL_ID,
        description: 'Автовыбор OpenRouter (профиль auto не создан)',
      });
    }

    if (apiKey.routingMode === KeyRoutingMode.CUSTOM && apiKey.modelChain.length) {
      const chain = this.getChainModels(apiKey);
      const seenOr = new Set<string>();
      for (const m of chain) {
        if (seenOr.has(m.openrouterId)) continue;
        seenOr.add(m.openrouterId);
        const sell = this.resolveSellPrice(apiKey, m.id, Number(m.inputPrice));
        items.push({
          id: m.openrouterId,
          type: 'openrouter',
          modelId: m.id,
          name: m.name,
          slug: m.openrouterId,
          openrouterId: m.openrouterId,
          provider: m.provider,
          isFree: m.isFree,
          pricePerMillionRub: sell,
        });
      }
    }

    const availableSlugs = API_MODEL_PROFILE_SLUGS.filter((s) => seenSlugs.has(s));

    return {
      data: items,
      defaultModel: 'auto',
      models: availableSlugs,
    };
  }

  private async ensureUniqueSlug(userId: string, slug: string, excludeId?: string) {
    const existing = await this.prisma.keyModelProfile.findUnique({
      where: { userId_slug: { userId, slug } },
    });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException(`Slug "${slug}" уже занят`);
    }
  }

  private async buildDefaultPricing(
    chain: { modelId: string }[],
    sellDefault: number,
  ) {
    const models = await this.prisma.model.findMany({
      where: { id: { in: chain.map((c) => c.modelId) } },
    });
    return chain.map((c) => {
      const model = models.find((m) => m.id === c.modelId);
      const costPrice = Number(model?.inputPrice ?? 0);
      const sellPrice = sellDefault > 0 ? sellDefault : costPrice;
      return { modelId: c.modelId, costPrice, sellPrice };
    });
  }

  private serializeProfile(profile: {
    id: string;
    userId: string;
    name: string;
    slug: string;
    description: string | null;
    pricePerMillionRub: Prisma.Decimal;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    chains: Array<{
      modelId: string;
      priority: number;
      model: { id: string; name: string; openrouterId: string; provider: string; isFree: boolean };
    }>;
    pricing: Array<{
      modelId: string;
      sellPrice: Prisma.Decimal;
      costPrice: Prisma.Decimal;
      model?: { name: string };
    }>;
  }) {
    return serializeBigInts({
      ...profile,
      pricePerMillionRub: Number(profile.pricePerMillionRub),
      modelChain: profile.chains.map((c) => ({
        modelId: c.modelId,
        priority: c.priority,
        model: c.model,
      })),
      pricing: profile.pricing.map((p) => ({
        modelId: p.modelId,
        sellPrice: Number(p.sellPrice),
        costPrice: Number(p.costPrice),
        model: p.model,
      })),
    });
  }
}
