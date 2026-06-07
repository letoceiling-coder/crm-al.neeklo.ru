import { Injectable, NotFoundException } from '@nestjs/common';
import { MemoryEntryType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CreateMemoryEntryDto } from './dto/memory.dto';
import { MemoryProfileService } from './memory-profile.service';
import { MemoryPlanLimitsService } from './memory-plan-limits.service';
import { MemoryEmbeddingService } from './memory-embedding.service';

@Injectable()
export class MemoryEntryService {
  constructor(
    private prisma: PrismaService,
    private profiles: MemoryProfileService,
    private limits: MemoryPlanLimitsService,
    private embeddings: MemoryEmbeddingService,
  ) {}

  async list(tenant: TenantContext, profileId: string, entryType?: MemoryEntryType, limit = 50) {
    await this.profiles.assertOwned(profileId, tenant.organizationId);
    return this.prisma.memoryEntry.findMany({
      where: {
        profileId,
        organizationId: tenant.organizationId,
        ...(entryType ? { entryType } : {}),
      },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(limit, 200),
    });
  }

  async create(
    tenant: TenantContext,
    profileId: string,
    dto: CreateMemoryEntryDto,
    options?: { skipIndex?: boolean },
  ) {
    await this.profiles.assertOwned(profileId, tenant.organizationId);
    const content = dto.content.trim();
    if (!content) throw new NotFoundException('Content required');

    await this.limits.assertCanCreateEntry(tenant.organizationId, content.length);

    const entry = await this.prisma.memoryEntry.create({
      data: {
        organizationId: tenant.organizationId,
        profileId,
        content,
        entryType: dto.entryType ?? MemoryEntryType.FACT,
        importance: dto.importance ?? 5,
        source: dto.source,
        metadata: (dto.metadata ?? {}) as object,
        charCount: content.length,
      },
    });

    if (!options?.skipIndex) {
      void this.embeddings.indexEntry(entry.id, tenant.organizationId, content);
    }

    return entry;
  }

  async remove(tenant: TenantContext, profileId: string, entryId: string) {
    await this.profiles.assertOwned(profileId, tenant.organizationId);
    const entry = await this.prisma.memoryEntry.findFirst({
      where: { id: entryId, profileId, organizationId: tenant.organizationId },
    });
    if (!entry) throw new NotFoundException('Memory entry not found');
    await this.embeddings.deleteForEntry(entryId);
    await this.prisma.memoryEntry.delete({ where: { id: entryId } });
    return { deleted: true };
  }

  async writeForWorkflow(
    tenant: TenantContext,
    config: Record<string, unknown>,
    context: Record<string, unknown>,
  ) {
    const profile = await this.resolveProfileFromConfig(tenant, config);
    const content = String(config.content ?? config.text ?? context.trigger ?? '');
    if (!content.trim()) throw new Error('Memory content required');

    const entry = await this.create(tenant, profile.id, {
      content: content.trim(),
      entryType: (config.entryType as MemoryEntryType) ?? MemoryEntryType.OBSERVATION,
      importance: Number(config.importance ?? 5),
      source: String(config.source ?? 'workflow'),
      metadata: { workflowContext: context.trigger ?? {} },
    });

    return { entryId: entry.id, profileId: profile.id, content: entry.content };
  }

  private async resolveProfileFromConfig(tenant: TenantContext, config: Record<string, unknown>) {
    if (config.profileId) {
      return this.profiles.resolveProfile(tenant, { profileId: String(config.profileId) });
    }
    const entityType = config.entityType as never;
    const entityId = String(config.entityId ?? '');
    if (entityType && entityId) {
      return this.profiles.getOrCreate(tenant, {
        entityType,
        entityId,
        name: config.name ? String(config.name) : undefined,
      });
    }
    throw new Error('profileId or entityType+entityId required for memory write');
  }
}
