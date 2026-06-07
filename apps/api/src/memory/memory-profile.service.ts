import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { MemoryProfileEntityType, MemoryProfileStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import {
  CreateMemoryProfileDto,
  UpdateMemoryProfileDto,
  GetOrCreateProfileDto,
} from './dto/memory.dto';
import { MemoryPlanLimitsService } from './memory-plan-limits.service';

const DEFAULT_NAMES: Record<MemoryProfileEntityType, string> = {
  USER: 'Память пользователя',
  ASSISTANT: 'Память ассистента',
  ORGANIZATION: 'Память организации',
  CLIENT: 'Память клиента',
  WORKFLOW: 'Память workflow',
};

@Injectable()
export class MemoryProfileService {
  constructor(
    private prisma: PrismaService,
    private limits: MemoryPlanLimitsService,
  ) {}

  async list(tenant: TenantContext, entityType?: MemoryProfileEntityType) {
    return this.prisma.memoryProfile.findMany({
      where: {
        organizationId: tenant.organizationId,
        ...(entityType ? { entityType } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { entries: true, summaries: true } } },
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    return this.prisma.memoryProfile.findUnique({
      where: { id },
      include: {
        _count: { select: { entries: true, summaries: true } },
        summaries: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  }

  async create(tenant: TenantContext, dto: CreateMemoryProfileDto) {
    await this.limits.assertCanCreateProfile(tenant.organizationId);
    return this.prisma.memoryProfile.create({
      data: {
        organizationId: tenant.organizationId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        name: dto.name,
        settings: (dto.settings ?? {}) as object,
      },
    });
  }

  async getOrCreate(tenant: TenantContext, dto: GetOrCreateProfileDto) {
    const existing = await this.prisma.memoryProfile.findUnique({
      where: {
        organizationId_entityType_entityId: {
          organizationId: tenant.organizationId,
          entityType: dto.entityType,
          entityId: dto.entityId,
        },
      },
    });
    if (existing) return existing;

    await this.limits.assertCanCreateProfile(tenant.organizationId);
    return this.prisma.memoryProfile.create({
      data: {
        organizationId: tenant.organizationId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        name: dto.name ?? DEFAULT_NAMES[dto.entityType],
      },
    });
  }

  async ensureAssistantProfile(organizationId: string, assistantId: string, assistantName: string) {
    const existing = await this.prisma.memoryProfile.findUnique({
      where: {
        organizationId_entityType_entityId: {
          organizationId,
          entityType: MemoryProfileEntityType.ASSISTANT,
          entityId: assistantId,
        },
      },
    });
    if (existing) return existing;

    try {
      await this.limits.assertCanCreateProfile(organizationId);
    } catch {
      return null;
    }

    return this.prisma.memoryProfile.create({
      data: {
        organizationId,
        entityType: MemoryProfileEntityType.ASSISTANT,
        entityId: assistantId,
        name: `Память: ${assistantName}`,
      },
    });
  }

  async ensureOrganizationProfile(organizationId: string, orgName: string) {
    return this.getOrCreate(
      {
        organizationId,
        userId: 'system',
        email: 'system@local',
        role: 'USER' as never,
        organizationRole: 'OWNER' as never,
      },
      {
        entityType: MemoryProfileEntityType.ORGANIZATION,
        entityId: organizationId,
        name: `Память: ${orgName}`,
      },
    );
  }

  async update(tenant: TenantContext, id: string, dto: UpdateMemoryProfileDto) {
    await this.assertOwned(id, tenant.organizationId);
    return this.prisma.memoryProfile.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.settings !== undefined ? { settings: dto.settings as object } : {}),
      },
    });
  }

  async remove(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    await this.prisma.memoryProfile.delete({ where: { id } });
    return { deleted: true };
  }

  async resolveProfile(
    tenant: TenantContext,
    opts: { profileId?: string; entityType?: MemoryProfileEntityType; entityId?: string },
  ) {
    if (opts.profileId) {
      await this.assertOwned(opts.profileId, tenant.organizationId);
      const p = await this.prisma.memoryProfile.findUnique({ where: { id: opts.profileId } });
      if (!p) throw new NotFoundException('Memory profile not found');
      return p;
    }
    if (opts.entityType && opts.entityId) {
      const p = await this.prisma.memoryProfile.findUnique({
        where: {
          organizationId_entityType_entityId: {
            organizationId: tenant.organizationId,
            entityType: opts.entityType,
            entityId: opts.entityId,
          },
        },
      });
      if (!p) throw new NotFoundException('Memory profile not found');
      return p;
    }
    throw new NotFoundException('profileId or entityType+entityId required');
  }

  async assertOwned(id: string, organizationId: string) {
    const row = await this.prisma.memoryProfile.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Memory profile not found');
    if (row.organizationId !== organizationId) {
      throw new ForbiddenException('Memory profile belongs to another organization');
    }
    return row;
  }
}
