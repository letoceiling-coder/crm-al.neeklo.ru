import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AIProvider, ProviderAccountStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecretEncryptionService } from '../secrets/secret-encryption.service';
import { SecretRotationService } from '../secrets/secret-rotation.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CreateProviderAccountDto, UpdateProviderAccountDto } from './dto/provider-accounts.dto';

@Injectable()
export class ProviderAccountsService {
  constructor(
    private prisma: PrismaService,
    private secrets: SecretEncryptionService,
    private rotation: SecretRotationService,
  ) {}

  async findAll(tenant: TenantContext) {
    const orgFilter = tenant.role === UserRole.ADMIN
      ? { OR: [{ organizationId: tenant.organizationId }, { organizationId: null }] }
      : { organizationId: tenant.organizationId };

    return this.prisma.providerAccount.findMany({
      where: orgFilter,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        organizationId: true,
        provider: true,
        name: true,
        isDefault: true,
        status: true,
        baseUrl: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(tenant: TenantContext, dto: CreateProviderAccountDto) {
    if (!dto.apiKey) {
      throw new BadRequestException('apiKey is required');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.providerAccount.updateMany({
          where: {
            organizationId: tenant.organizationId,
            provider: dto.provider,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }

      const account = await tx.providerAccount.create({
        data: {
          organizationId: tenant.organizationId,
          provider: dto.provider,
          name: dto.name,
          isDefault: dto.isDefault ?? false,
          baseUrl: dto.baseUrl,
          metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });

      const secret = await this.secrets.storeSecret({
        organizationId: tenant.organizationId,
        key: 'api_key',
        plainValue: dto.apiKey,
      });

      return tx.providerAccount.update({
        where: { id: account.id },
        data: { apiKeySecretId: secret.id },
        select: {
          id: true,
          provider: true,
          name: true,
          isDefault: true,
          status: true,
          baseUrl: true,
          createdAt: true,
        },
      });
    });
  }

  async update(tenant: TenantContext, id: string, dto: UpdateProviderAccountDto) {
    const account = await this.findOwnedAccount(id, tenant);
    if (dto.apiKey) {
      await this.rotation.rotateProviderAccountKey(account.id, dto.apiKey, tenant.organizationId);
    }
    return this.prisma.providerAccount.update({
      where: { id: account.id },
      data: {
        name: dto.name,
        status: dto.status,
        baseUrl: dto.baseUrl,
        isDefault: dto.isDefault,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async setDefault(tenant: TenantContext, id: string) {
    const account = await this.findOwnedAccount(id, tenant);
    await this.prisma.$transaction([
      this.prisma.providerAccount.updateMany({
        where: {
          organizationId: tenant.organizationId,
          provider: account.provider,
        },
        data: { isDefault: false },
      }),
      this.prisma.providerAccount.update({
        where: { id: account.id },
        data: { isDefault: true },
      }),
    ]);
    return { isDefault: true };
  }

  async testConnection(tenant: TenantContext, id: string) {
    const account = await this.findOwnedAccount(id, tenant);
    const apiKey = await this.secrets.getSecretByProviderAccount(account.id, tenant.organizationId);
    if (!apiKey) throw new BadRequestException('No API key configured');

    const baseUrl =
      account.baseUrl ||
      (account.provider === AIProvider.OPENROUTER
        ? 'https://openrouter.ai/api/v1'
        : null);
    if (!baseUrl) throw new BadRequestException('baseUrl is required for this provider');

    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return { ok: res.ok, status: res.status };
  }

  async getDefaultForProvider(provider: AIProvider, organizationId?: string) {
    if (organizationId) {
      const orgDefault = await this.prisma.providerAccount.findFirst({
        where: {
          organizationId,
          provider,
          isDefault: true,
          status: ProviderAccountStatus.ACTIVE,
        },
      });
      if (orgDefault) return orgDefault;
    }
    return this.prisma.providerAccount.findFirst({
      where: {
        organizationId: null,
        provider,
        isDefault: true,
        status: ProviderAccountStatus.ACTIVE,
      },
    });
  }

  async getApiKeyForAccount(accountId: string, organizationId?: string): Promise<string | null> {
    return this.secrets.getSecretByProviderAccount(accountId, organizationId);
  }

  private async findOwnedAccount(id: string, tenant: TenantContext) {
    const account = await this.prisma.providerAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Provider account not found');
    if (account.organizationId && account.organizationId !== tenant.organizationId) {
      throw new ForbiddenException('Access denied');
    }
    if (!account.organizationId && tenant.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Platform accounts are admin-only');
    }
    return account;
  }
}
