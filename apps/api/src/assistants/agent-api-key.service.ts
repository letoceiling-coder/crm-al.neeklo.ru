import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KeyAgentService } from './key-agent.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CreateAgentApiKeyDto, RotateAgentApiKeyDto } from './dto/agent-api-key.dto';
import {
  encryptApiKey,
  generateAgentApiKey,
  decryptApiKey,
} from '../common/utils/crypto.util';
import { ApiKeyStatus } from '@prisma/client';

function stripAgentKeySecrets<T extends { keyHash?: string; keyEncrypted?: string | null }>(
  row: T,
): Omit<T, 'keyHash' | 'keyEncrypted'> {
  const { keyHash: _h, keyEncrypted: _e, ...rest } = row;
  return rest;
}

@Injectable()
export class AgentApiKeyService {
  constructor(
    private prisma: PrismaService,
    private keyAgents: KeyAgentService,
  ) {}

  private async assertBillingKey(apiKeyId: string, organizationId: string) {
    const apiKey = await this.prisma.apiKey.findUnique({ where: { id: apiKeyId } });
    if (!apiKey) throw new NotFoundException('Billing API key not found');
    if (apiKey.organizationId !== organizationId) {
      throw new ForbiddenException('Billing API key belongs to another organization');
    }
    return apiKey;
  }

  async list(tenant: TenantContext, keyAgentId: string) {
    await this.keyAgents.assertOwned(keyAgentId, tenant.organizationId);
    const keys = await this.prisma.agentApiKey.findMany({
      where: { keyAgentId },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map(stripAgentKeySecrets);
  }

  async create(tenant: TenantContext, keyAgentId: string, dto: CreateAgentApiKeyDto) {
    await this.keyAgents.assertOwned(keyAgentId, tenant.organizationId);
    await this.assertBillingKey(dto.apiKeyId, tenant.organizationId);

    const limits = await this.prisma.planLimits.findUnique({
      where: { organizationId: tenant.organizationId },
    });
    const maxKeys = limits?.maxAgentApiKeys ?? 20;
    const count = await this.prisma.agentApiKey.count({ where: { keyAgentId } });
    if (count >= maxKeys) {
      throw new BadRequestException(`Plan limit reached: max ${maxKeys} agent API keys per assistant`);
    }

    const { key, prefix, hash } = generateAgentApiKey();
    const encrypted = encryptApiKey(key);

    const created = await this.prisma.agentApiKey.create({
      data: {
        keyAgentId,
        apiKeyId: dto.apiKeyId,
        name: dto.name,
        environment: dto.environment,
        scopes: dto.scopes,
        keyHash: hash,
        keyPrefix: prefix,
        keyEncrypted: encrypted,
        allowedIps: dto.allowedIps ?? [],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    return {
      ...stripAgentKeySecrets(created),
      key,
    };
  }

  async rotate(
    tenant: TenantContext,
    keyAgentId: string,
    keyId: string,
    dto: RotateAgentApiKeyDto,
  ) {
    await this.keyAgents.assertOwned(keyAgentId, tenant.organizationId);
    const existing = await this.prisma.agentApiKey.findUnique({ where: { id: keyId } });
    if (!existing || existing.keyAgentId !== keyAgentId) {
      throw new NotFoundException('Agent API key not found');
    }
    if (existing.status !== ApiKeyStatus.ACTIVE) {
      throw new BadRequestException('Cannot rotate inactive or revoked key');
    }

    const { key, prefix, hash } = generateAgentApiKey();
    const encrypted = encryptApiKey(key);

    const updated = await this.prisma.agentApiKey.update({
      where: { id: keyId },
      data: {
        name: dto.name ?? existing.name,
        keyHash: hash,
        keyPrefix: prefix,
        keyEncrypted: encrypted,
        revokedAt: null,
        status: ApiKeyStatus.ACTIVE,
      },
    });

    return {
      ...stripAgentKeySecrets(updated),
      key,
    };
  }

  async revoke(tenant: TenantContext, keyAgentId: string, keyId: string) {
    await this.keyAgents.assertOwned(keyAgentId, tenant.organizationId);
    const existing = await this.prisma.agentApiKey.findUnique({ where: { id: keyId } });
    if (!existing || existing.keyAgentId !== keyAgentId) {
      throw new NotFoundException('Agent API key not found');
    }

    const updated = await this.prisma.agentApiKey.update({
      where: { id: keyId },
      data: {
        status: ApiKeyStatus.INACTIVE,
        revokedAt: new Date(),
      },
    });
    return stripAgentKeySecrets(updated);
  }

  async reveal(tenant: TenantContext, keyAgentId: string, keyId: string) {
    await this.keyAgents.assertOwned(keyAgentId, tenant.organizationId);
    const existing = await this.prisma.agentApiKey.findUnique({
      where: { id: keyId },
      select: { id: true, keyAgentId: true, keyEncrypted: true, keyPrefix: true, status: true },
    });
    if (!existing || existing.keyAgentId !== keyAgentId) {
      throw new NotFoundException('Agent API key not found');
    }
    if (!existing.keyEncrypted) {
      throw new BadRequestException('Key material unavailable — rotate to generate a new key');
    }
    return { key: decryptApiKey(existing.keyEncrypted) };
  }
}
