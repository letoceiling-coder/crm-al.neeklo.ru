import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTokenCostSnapshotDto } from './dto/token-cost.dto';

@Injectable()
export class TokenCostService {
  constructor(private prisma: PrismaService) {}

  async resolveSnapshot(provider: string, model: string, at = new Date()) {
    return this.prisma.tokenCostSnapshot.findFirst({
      where: {
        provider,
        model,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  computeCostUsd(
    snapshot: {
      inputPrice: { toString(): string };
      outputPrice: { toString(): string };
    },
    inputTokens: number,
    outputTokens: number,
  ): number {
    const inputPrice = Number(snapshot.inputPrice);
    const outputPrice = Number(snapshot.outputPrice);
    return (inputTokens / 1_000_000) * inputPrice + (outputTokens / 1_000_000) * outputPrice;
  }

  async resolveAndCompute(provider: string, model: string, inputTokens: number, outputTokens: number) {
    const snapshot = await this.resolveSnapshot(provider, model);
    if (!snapshot) return { snapshot: null, costUsd: null };
    return {
      snapshot,
      costUsd: this.computeCostUsd(snapshot, inputTokens, outputTokens),
    };
  }

  async list(provider?: string, model?: string) {
    return this.prisma.tokenCostSnapshot.findMany({
      where: {
        ...(provider ? { provider } : {}),
        ...(model ? { model } : {}),
      },
      orderBy: [{ provider: 'asc' }, { model: 'asc' }, { effectiveFrom: 'desc' }],
    });
  }

  async create(dto: CreateTokenCostSnapshotDto) {
    const effectiveFrom = new Date(dto.effectiveFrom);

    await this.prisma.tokenCostSnapshot.updateMany({
      where: {
        provider: dto.provider,
        model: dto.model,
        effectiveTo: null,
        effectiveFrom: { lt: effectiveFrom },
      },
      data: { effectiveTo: effectiveFrom },
    });

    return this.prisma.tokenCostSnapshot.create({
      data: {
        provider: dto.provider,
        model: dto.model,
        inputPrice: dto.inputPrice,
        outputPrice: dto.outputPrice,
        cachedInputPrice: dto.cachedInputPrice,
        cachedOutputPrice: dto.cachedOutputPrice,
        effectiveFrom,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      },
    });
  }

  async syncFromModels() {
    const models = await this.prisma.model.findMany({ where: { isEnabled: true } });
    const now = new Date();
    let created = 0;

    for (const model of models) {
      const existing = await this.resolveSnapshot('openrouter', model.openrouterId, now);
      const inputPrice = Number(model.inputPrice);
      const outputPrice = Number(model.outputPrice);
      if (
        existing &&
        Number(existing.inputPrice) === inputPrice &&
        Number(existing.outputPrice) === outputPrice
      ) {
        continue;
      }
      await this.create({
        provider: 'openrouter',
        model: model.openrouterId,
        inputPrice,
        outputPrice,
        effectiveFrom: now.toISOString(),
      });
      created += 1;
    }

    return { synced: created, totalModels: models.length };
  }
}
