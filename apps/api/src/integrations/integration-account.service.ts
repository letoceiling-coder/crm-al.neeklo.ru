import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { IntegrationAccountStatus, IntegrationProviderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecretEncryptionService } from '../secrets/secret-encryption.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CreateIntegrationAccountDto, UpdateIntegrationAccountDto } from './dto/integration.dto';
import { PROVIDER_ID_MAP } from './integration.constants';
import { generateWebhookSecret } from './integration-signature.util';

@Injectable()
export class IntegrationAccountService {
  constructor(
    private prisma: PrismaService,
    private secrets: SecretEncryptionService,
  ) {}

  async list(tenant: TenantContext, provider?: IntegrationProviderType) {
    return this.prisma.integrationAccount.findMany({
      where: {
        organizationId: tenant.organizationId,
        ...(provider ? { provider } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        providerRef: { select: { name: true, provider: true } },
        _count: { select: { channels: true, conversations: true } },
      },
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    return this.prisma.integrationAccount.findUnique({
      where: { id },
      include: {
        providerRef: true,
        channels: { include: { assistant: { select: { id: true, name: true } } } },
      },
    });
  }

  async create(tenant: TenantContext, dto: CreateIntegrationAccountDto) {
    const providerId = PROVIDER_ID_MAP[dto.provider];
    const providerRef = await this.prisma.integrationProvider.findUnique({ where: { id: providerId } });
    if (!providerRef) throw new BadRequestException('Unknown provider');

    let secretId: string | undefined;
    if (dto.secret) {
      const secret = await this.secrets.storeSecret({
        organizationId: tenant.organizationId,
        key: `integration:${dto.provider.toLowerCase()}`,
        plainValue: dto.secret,
      });
      secretId = secret.id;
    }

    const webhookSecret = generateWebhookSecret();

    return this.prisma.integrationAccount.create({
      data: {
        organizationId: tenant.organizationId,
        providerId: providerRef.id,
        provider: dto.provider,
        name: dto.name,
        settings: (dto.settings ?? {}) as object,
        secretId,
        webhookSecret,
        status: dto.secret ? IntegrationAccountStatus.ACTIVE : IntegrationAccountStatus.PENDING,
      },
      include: { providerRef: true },
    });
  }

  async update(tenant: TenantContext, id: string, dto: UpdateIntegrationAccountDto) {
    await this.assertOwned(id, tenant.organizationId);
    let secretId: string | undefined;
    if (dto.secret) {
      const account = await this.prisma.integrationAccount.findUnique({ where: { id } });
      if (account?.secretId) {
        await this.secrets.updateSecret(account.secretId, tenant.organizationId, dto.secret);
      } else {
        const secret = await this.secrets.storeSecret({
          organizationId: tenant.organizationId,
          key: `integration:${account?.provider.toLowerCase() ?? 'custom'}`,
          plainValue: dto.secret,
        });
        secretId = secret.id;
      }
    }

    return this.prisma.integrationAccount.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.settings !== undefined ? { settings: dto.settings as object } : {}),
        ...(secretId ? { secretId, status: IntegrationAccountStatus.ACTIVE } : {}),
      },
    });
  }

  async remove(tenant: TenantContext, id: string) {
    const account = await this.assertOwned(id, tenant.organizationId);
    if (account.secretId) {
      await this.secrets.deleteSecret(account.secretId, tenant.organizationId).catch(() => null);
    }
    await this.prisma.integrationAccount.delete({ where: { id } });
    return { deleted: true };
  }

  async findForWebhook(accountId: string) {
    const account = await this.prisma.integrationAccount.findUnique({
      where: { id: accountId },
      include: { providerRef: true },
    });
    if (!account || account.status === IntegrationAccountStatus.INACTIVE) {
      throw new NotFoundException('Integration account not found');
    }
    return account;
  }

  async assertOwned(id: string, organizationId: string) {
    const row = await this.prisma.integrationAccount.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Integration account not found');
    if (row.organizationId !== organizationId) {
      throw new ForbiddenException('Integration account belongs to another organization');
    }
    return row;
  }

  async getSecret(accountId: string, organizationId: string): Promise<string | null> {
    const account = await this.assertOwned(accountId, organizationId);
    if (!account.secretId) return null;
    return this.secrets.getSecret(account.secretId, organizationId);
  }
}
