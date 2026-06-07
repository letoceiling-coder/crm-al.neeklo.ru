import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { IntegrationAccountService } from './integration-account.service';
import { BindAssistantChannelDto } from './dto/integration.dto';

@Injectable()
export class AssistantChannelService {
  constructor(
    private prisma: PrismaService,
    private accounts: IntegrationAccountService,
  ) {}

  async listForAssistant(tenant: TenantContext, assistantId: string) {
    await this.assertAssistantOwned(assistantId, tenant.organizationId);
    return this.prisma.assistantIntegrationChannel.findMany({
      where: { assistantId, organizationId: tenant.organizationId },
      include: {
        integrationAccount: { include: { providerRef: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async bind(tenant: TenantContext, assistantId: string, dto: BindAssistantChannelDto) {
    await this.assertAssistantOwned(assistantId, tenant.organizationId);
    await this.accounts.assertOwned(dto.integrationAccountId, tenant.organizationId);

    return this.prisma.assistantIntegrationChannel.upsert({
      where: {
        assistantId_integrationAccountId: {
          assistantId,
          integrationAccountId: dto.integrationAccountId,
        },
      },
      create: {
        organizationId: tenant.organizationId,
        assistantId,
        integrationAccountId: dto.integrationAccountId,
        enabled: dto.enabled ?? true,
        settings: (dto.settings ?? {}) as object,
      },
      update: {
        enabled: dto.enabled ?? true,
        settings: (dto.settings ?? {}) as object,
      },
      include: { integrationAccount: { include: { providerRef: true } } },
    });
  }

  async unbind(tenant: TenantContext, assistantId: string, channelId: string) {
    await this.assertAssistantOwned(assistantId, tenant.organizationId);
    const row = await this.prisma.assistantIntegrationChannel.findFirst({
      where: { id: channelId, assistantId, organizationId: tenant.organizationId },
    });
    if (!row) throw new NotFoundException('Channel binding not found');
    await this.prisma.assistantIntegrationChannel.delete({ where: { id: channelId } });
    return { deleted: true };
  }

  async resolveAssistantForAccount(accountId: string) {
    const binding = await this.prisma.assistantIntegrationChannel.findFirst({
      where: { integrationAccountId: accountId, enabled: true },
      orderBy: { createdAt: 'asc' },
    });
    return binding?.assistantId;
  }

  private async assertAssistantOwned(assistantId: string, organizationId: string) {
    const agent = await this.prisma.keyAgent.findUnique({ where: { id: assistantId } });
    if (!agent) throw new NotFoundException('Assistant not found');
    if (agent.organizationId !== organizationId) {
      throw new ForbiddenException('Assistant belongs to another organization');
    }
    return agent;
  }
}
