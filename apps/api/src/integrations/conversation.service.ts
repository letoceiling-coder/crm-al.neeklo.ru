import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConversationChannel, ConversationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ListConversationsQueryDto } from './dto/integration.dto';

@Injectable()
export class ConversationService {
  constructor(private prisma: PrismaService) {}

  async list(tenant: TenantContext, query: ListConversationsQueryDto) {
    return this.prisma.conversation.findMany({
      where: {
        organizationId: tenant.organizationId,
        ...(query.channel ? { channel: query.channel } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.assistantId ? { assistantId: query.assistantId } : {}),
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: {
        assistant: { select: { id: true, name: true } },
        integrationAccount: { select: { id: true, name: true, provider: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    return this.prisma.conversation.findUnique({
      where: { id },
      include: {
        assistant: { select: { id: true, name: true } },
        integrationAccount: { select: { id: true, name: true, provider: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async upsert(params: {
    organizationId: string;
    channel: ConversationChannel;
    externalId: string;
    assistantId?: string;
    integrationAccountId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const existing = await this.prisma.conversation.findUnique({
      where: {
        organizationId_channel_externalId: {
          organizationId: params.organizationId,
          channel: params.channel,
          externalId: params.externalId,
        },
      },
    });

    if (existing) {
      return this.prisma.conversation.update({
        where: { id: existing.id },
        data: {
          lastMessageAt: new Date(),
          ...(params.assistantId ? { assistantId: params.assistantId } : {}),
          ...(params.integrationAccountId ? { integrationAccountId: params.integrationAccountId } : {}),
        },
      });
    }

    return this.prisma.conversation.create({
      data: {
        organizationId: params.organizationId,
        channel: params.channel,
        externalId: params.externalId,
        assistantId: params.assistantId,
        integrationAccountId: params.integrationAccountId,
        lastMessageAt: new Date(),
        metadata: (params.metadata ?? {}) as object,
      },
    });
  }

  async assertOwned(id: string, organizationId: string) {
    const row = await this.prisma.conversation.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Conversation not found');
    if (row.organizationId !== organizationId) {
      throw new ForbiddenException('Conversation belongs to another organization');
    }
    return row;
  }
}
