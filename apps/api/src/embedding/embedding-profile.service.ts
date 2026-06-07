import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Injectable()
export class EmbeddingProfileService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenant: TenantContext) {
    return this.prisma.embeddingProfile.findMany({
      where: {
        OR: [{ organizationId: tenant.organizationId }, { organizationId: null }],
        isActive: true,
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async findDefault(tenant: TenantContext) {
    const profile = await this.prisma.embeddingProfile.findFirst({
      where: {
        OR: [{ organizationId: tenant.organizationId }, { organizationId: null }],
        isDefault: true,
        isActive: true,
      },
    });
    if (!profile) throw new NotFoundException('Default embedding profile not found');
    return profile;
  }

  async createPlatformDefault(params: {
    name: string;
    model: string;
    dimensions?: number;
    providerAccountId?: string;
  }) {
    return this.prisma.embeddingProfile.create({
      data: {
        organizationId: null,
        name: params.name,
        model: params.model,
        dimensions: params.dimensions ?? 3072,
        provider: 'openrouter',
        isDefault: true,
        isActive: true,
        providerAccountId: params.providerAccountId,
      },
    });
  }
}
