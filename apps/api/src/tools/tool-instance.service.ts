import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { SecretEncryptionService } from '../secrets/secret-encryption.service';
import { ToolsPlanLimitsService } from './tools-plan-limits.service';
import { ToolCatalogService } from './tool-catalog.service';
import { CreateToolInstanceDto, UpdateToolInstanceDto, SetToolSecretDto } from './dto/tool.dto';

@Injectable()
export class ToolInstanceService {
  constructor(
    private prisma: PrismaService,
    private secrets: SecretEncryptionService,
    private limits: ToolsPlanLimitsService,
    private catalog: ToolCatalogService,
  ) {}

  async list(tenant: TenantContext) {
    return this.prisma.toolInstance.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: { updatedAt: 'desc' },
      include: {
        definition: {
          select: {
            id: true,
            slug: true,
            name: true,
            providerType: true,
            description: true,
            metadata: true,
          },
        },
        executionLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            latencyMs: true,
            createdAt: true,
          },
        },
        _count: { select: { bindings: true } },
      },
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    const instance = await this.assertOwned(id, tenant.organizationId);
    return this.prisma.toolInstance.findUnique({
      where: { id: instance.id },
      include: {
        definition: {
          include: { provider: { select: { slug: true, name: true, providerType: true } } },
        },
        secret: { select: { id: true, key: true, createdAt: true, rotatedAt: true } },
        executionLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async create(tenant: TenantContext, dto: CreateToolInstanceDto) {
    await this.limits.assertCanCreateInstance(tenant.organizationId);
    const definition = await this.catalog.getBySlug(dto.toolDefinitionSlug);

    let secretId: string | undefined;
    if (dto.secret) {
      const secret = await this.secrets.storeSecret({
        organizationId: tenant.organizationId,
        key: 'credential',
        plainValue: dto.secret,
      });
      secretId = secret.id;
    }

    const instance = await this.prisma.toolInstance.create({
      data: {
        organizationId: tenant.organizationId,
        toolDefinitionId: definition.id,
        name: dto.name,
        settings: (dto.settings ?? {}) as object,
        secretId,
      },
      include: {
        definition: { select: { slug: true, name: true, providerType: true } },
      },
    });

    if (secretId) {
      await this.prisma.encryptedSecret.update({
        where: { id: secretId },
        data: { toolInstanceId: instance.id },
      });
    }

    return instance;
  }

  async update(tenant: TenantContext, id: string, dto: UpdateToolInstanceDto) {
    await this.assertOwned(id, tenant.organizationId);

    let secretId: string | undefined;
    if (dto.secret) {
      const existing = await this.prisma.toolInstance.findUnique({ where: { id } });
      if (existing?.secretId) {
        await this.secrets.updateSecret(existing.secretId, tenant.organizationId, dto.secret);
      } else {
        const secret = await this.secrets.storeSecret({
          organizationId: tenant.organizationId,
          key: 'credential',
          plainValue: dto.secret,
          toolInstanceId: id,
        });
        secretId = secret.id;
      }
    }

    return this.prisma.toolInstance.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.settings !== undefined ? { settings: dto.settings as object } : {}),
        ...(secretId ? { secretId } : {}),
      },
      include: {
        definition: { select: { slug: true, name: true, providerType: true } },
      },
    });
  }

  async setSecret(tenant: TenantContext, id: string, dto: SetToolSecretDto) {
    await this.assertOwned(id, tenant.organizationId);
    const instance = await this.prisma.toolInstance.findUnique({ where: { id } });

    if (instance?.secretId) {
      await this.secrets.updateSecret(instance.secretId, tenant.organizationId, dto.secret);
      return { secretId: instance.secretId, updated: true };
    }

    const secret = await this.secrets.storeSecret({
      organizationId: tenant.organizationId,
      key: dto.key ?? 'credential',
      plainValue: dto.secret,
      toolInstanceId: id,
    });

    await this.prisma.toolInstance.update({
      where: { id },
      data: { secretId: secret.id },
    });

    return { secretId: secret.id, updated: false };
  }

  async remove(tenant: TenantContext, id: string) {
    const instance = await this.assertOwned(id, tenant.organizationId);
    if (instance.secretId) {
      await this.secrets.deleteSecret(instance.secretId, tenant.organizationId).catch(() => undefined);
    }
    await this.prisma.toolInstance.delete({ where: { id } });
    return { deleted: true };
  }

  async assertOwned(id: string, organizationId: string) {
    const instance = await this.prisma.toolInstance.findUnique({ where: { id } });
    if (!instance) throw new NotFoundException('Tool instance not found');
    if (instance.organizationId !== organizationId) {
      throw new ForbiddenException('Tool instance belongs to another organization');
    }
    return instance;
  }

  async getWithDefinition(id: string, organizationId: string) {
    const instance = await this.assertOwned(id, organizationId);
    return this.prisma.toolInstance.findUnique({
      where: { id: instance.id },
      include: {
        definition: { include: { provider: true } },
        secret: true,
      },
    });
  }
}
