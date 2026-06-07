import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MemoryPlanLimitsService {
  constructor(private prisma: PrismaService) {}

  private async limits(organizationId: string) {
    return (
      (await this.prisma.planLimits.findUnique({ where: { organizationId } })) ?? {
        maxMemoryProfiles: 50,
        maxMemoryEntries: 10000,
        maxMemoryStorageMb: 100,
      }
    );
  }

  async assertCanCreateProfile(organizationId: string) {
    const lim = await this.limits(organizationId);
    const count = await this.prisma.memoryProfile.count({ where: { organizationId } });
    if (count >= lim.maxMemoryProfiles) {
      throw new BadRequestException(`Лимит профилей памяти: ${lim.maxMemoryProfiles}`);
    }
  }

  async assertCanCreateEntry(organizationId: string, additionalChars: number) {
    const lim = await this.limits(organizationId);
    const count = await this.prisma.memoryEntry.count({ where: { organizationId } });
    if (count >= lim.maxMemoryEntries) {
      throw new BadRequestException(`Лимит записей памяти: ${lim.maxMemoryEntries}`);
    }

    const agg = await this.prisma.memoryEntry.aggregate({
      where: { organizationId },
      _sum: { charCount: true },
    });
    const maxBytes = lim.maxMemoryStorageMb * 1024 * 1024;
    const used = (agg._sum.charCount ?? 0) * 2;
    if (used + additionalChars * 2 > maxBytes) {
      throw new BadRequestException(`Лимит хранилища памяти: ${lim.maxMemoryStorageMb} MB`);
    }
  }
}
