import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenRouterService } from '../openrouter/openrouter.service';
import { AuditService } from '../audit/audit.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { skipTake, paginate } from '../common/utils/pagination.util';
import { AuditAction } from '@prisma/client';
import { UsageService } from '../usage/usage.service';

@Injectable()
export class ModelsService {
  constructor(
    private prisma: PrismaService,
    private openRouter: OpenRouterService,
    private audit: AuditService,
    private usage: UsageService,
  ) {}

  async findAll(
    query: PaginationQueryDto,
    filters?: {
      provider?: string;
      label?: string;
      search?: string;
      enabledOnly?: boolean;
      unlimited?: boolean;
    },
  ) {
    const where: Record<string, unknown> = {};
    if (filters?.provider) where.provider = filters.provider;
    if (filters?.enabledOnly) where.isEnabled = true;
    if (filters?.label) where.labels = { has: filters.label };
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { openrouterId: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const usePagination = !filters?.unlimited && query.limit != null;
    const findOptions = { where, orderBy: { name: 'asc' as const } };

    if (usePagination) {
      const { skip, take } = skipTake(query);
      const [items, total] = await Promise.all([
        this.prisma.model.findMany({ ...findOptions, skip, take }),
        this.prisma.model.count({ where }),
      ]);
      return paginate(items, total, query);
    }

    const items = await this.prisma.model.findMany(findOptions);
    return {
      data: items,
      meta: { total: items.length, page: 1, limit: items.length, totalPages: 1 },
    };
  }

  async findOne(id: string) {
    const model = await this.prisma.model.findUnique({ where: { id } });
    if (!model) throw new NotFoundException('Model not found');
    return model;
  }

  async syncFromOpenRouter(adminId: string) {
    const result = await this.openRouter.syncModels();
    const recalc = await this.usage.recalculateAllLogCosts();
    await this.audit.log(AuditAction.SETTINGS_CHANGED, adminId, {
      action: 'sync_models',
      result,
      recalc,
    });
    return { ...result, recalc };
  }

  async toggleEnabled(id: string, enabled: boolean, adminId: string) {
    const model = await this.prisma.model.update({
      where: { id },
      data: { isEnabled: enabled },
    });
    await this.audit.log(
      enabled ? AuditAction.MODEL_ENABLED : AuditAction.MODEL_DISABLED,
      adminId,
      { modelId: id },
    );
    return model;
  }

  async getProviders() {
    const providers = await this.prisma.model.groupBy({
      by: ['provider'],
      _count: { id: true },
    });
    return providers.map((p) => ({ name: p.provider, count: p._count.id }));
  }

  async getGlobalFallback() {
    return this.prisma.globalFallbackChain.findMany({
      orderBy: { priority: 'asc' },
      include: { model: true },
    });
  }

  async setGlobalFallback(modelIds: string[], adminId: string) {
    await this.prisma.globalFallbackChain.deleteMany();
    await this.prisma.globalFallbackChain.createMany({
      data: modelIds.map((modelId, index) => ({ modelId, priority: index })),
    });
    await this.audit.log(AuditAction.SETTINGS_CHANGED, adminId, { action: 'global_fallback' });
    return this.getGlobalFallback();
  }
}
