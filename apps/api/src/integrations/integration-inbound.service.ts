import { Injectable } from '@nestjs/common';
import { ConversationChannel, IntegrationProviderType, MessageDirection } from '@prisma/client';
import { ParsedInboundMessage } from './integration.constants';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { IntegrationEventService } from './integration-event.service';
import { AssistantChannelService } from './assistant-channel.service';
import { IntegrationAccountService } from './integration-account.service';
import { TelegramAdapter } from './providers/telegram.adapter';
import { MaxAdapter } from './providers/max.adapter';
import { EmailAdapter } from './providers/email.adapter';
import { WebhookAdapter } from './providers/webhook.adapter';
import { Bitrix24Adapter } from './providers/bitrix24.adapter';
import { AmoCrmAdapter } from './providers/amocrm.adapter';
import { MemoryEntryService } from '../memory/memory-entry.service';
import { MemoryProfileService } from '../memory/memory-profile.service';
import { AssistantChatService } from '../assistants/assistant-chat.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { MemoryEntryType, MemoryProfileEntityType } from '@prisma/client';
import { verifyWebhookSignature } from './integration-signature.util';

type AccountRow = {
  id: string;
  organizationId: string;
  provider: IntegrationProviderType;
  settings: unknown;
  webhookSecret: string | null;
};

@Injectable()
export class IntegrationInboundService {
  constructor(
    private conversations: ConversationService,
    private messages: MessageService,
    private events: IntegrationEventService,
    private channels: AssistantChannelService,
    private accounts: IntegrationAccountService,
    private telegram: TelegramAdapter,
    private max: MaxAdapter,
    private email: EmailAdapter,
    private webhook: WebhookAdapter,
    private bitrix: Bitrix24Adapter,
    private amo: AmoCrmAdapter,
    private memoryEntries: MemoryEntryService,
    private memoryProfiles: MemoryProfileService,
    private chat: AssistantChatService,
  ) {}

  async handleInbound(
    account: AccountRow,
    payload: Record<string, unknown>,
    headers?: Record<string, string>,
  ) {
    const parsed = this.parse(account.provider, payload, headers);
    if (!parsed) return { ignored: true };

    const assistantId =
      (await this.channels.resolveAssistantForAccount(account.id)) ??
      (account.settings as { defaultAssistantId?: string })?.defaultAssistantId;

    const conversation = await this.conversations.upsert({
      organizationId: account.organizationId,
      channel: parsed.channel as ConversationChannel,
      externalId: parsed.externalId,
      assistantId,
      integrationAccountId: account.id,
      metadata: parsed.metadata,
    });

    const message = await this.messages.create({
      conversationId: conversation.id,
      direction: MessageDirection.INBOUND,
      content: parsed.content,
      attachments: parsed.attachments,
      metadata: parsed.metadata,
    });

    const workflowEvent = parsed.workflowEvent ?? 'message.received';
    await this.events.record({
      organizationId: account.organizationId,
      provider: account.provider,
      accountId: account.id,
      eventType: workflowEvent,
      payload: {
        conversationId: conversation.id,
        messageId: message.id,
        content: parsed.content,
        channel: parsed.channel,
        externalId: parsed.externalId,
        assistantId,
      },
    });

    const settings = (account.settings ?? {}) as {
      writeToAssistantMemory?: boolean;
      writeToOrganizationMemory?: boolean;
    };

    const tenant = await this.buildTenant(account.organizationId, assistantId);

    if (settings.writeToAssistantMemory && assistantId) {
      void this.writeAssistantMemory(tenant, assistantId, parsed.content, account.provider);
    }
    if (settings.writeToOrganizationMemory) {
      void this.writeOrgMemory(tenant, parsed.content, account.provider);
    }

    if (assistantId && (account.settings as { autoReply?: boolean })?.autoReply !== false) {
      const reply = await this.chat.chat(tenant, assistantId, parsed.content).catch(() => null);
      if (reply?.answer) {
        await this.messages.create({
          conversationId: conversation.id,
          direction: MessageDirection.OUTBOUND,
          content: reply.answer,
          metadata: { model: reply.model, memoryHits: reply.memoryHits },
        });
        await this.sendReply(account, parsed.externalId, reply.answer, parsed.channel);
      }
    }

    return { conversationId: conversation.id, messageId: message.id, eventType: workflowEvent };
  }

  async sendReply(
    account: AccountRow,
    externalId: string,
    text: string,
    channel: string,
  ) {
    const secret = await this.accounts.getSecret(account.id, account.organizationId);
    switch (account.provider) {
      case IntegrationProviderType.TELEGRAM:
        return this.telegram.sendMessage(secret, externalId, text);
      case IntegrationProviderType.MAX:
        return this.max.sendMessage(secret, externalId, text, account.settings as Record<string, unknown>);
      case IntegrationProviderType.EMAIL:
        return this.email.sendMessage(account.settings as Record<string, unknown>, secret, externalId, text);
      default:
        return { queued: true, channel };
    }
  }

  verifySignature(account: AccountRow, rawBody: string, signature?: string): boolean {
    if (!account.webhookSecret) return true;
    return verifyWebhookSignature(account.webhookSecret, rawBody, signature);
  }

  private parse(
    provider: IntegrationProviderType,
    payload: Record<string, unknown>,
    headers?: Record<string, string>,
  ): ParsedInboundMessage | null {
    switch (provider) {
      case IntegrationProviderType.TELEGRAM:
        return this.telegram.parseInbound(payload);
      case IntegrationProviderType.MAX:
        return this.max.parseInbound(payload);
      case IntegrationProviderType.EMAIL:
        return this.email.parseInbound(payload);
      case IntegrationProviderType.WEBHOOK:
        return this.webhook.parseInbound(payload, headers);
      case IntegrationProviderType.BITRIX24:
        return this.bitrix.parseInbound(payload);
      case IntegrationProviderType.AMOCRM:
        return this.amo.parseInbound(payload);
      default:
        return this.webhook.parseInbound(payload, headers);
    }
  }

  private async writeAssistantMemory(
    tenant: TenantContext,
    assistantId: string,
    content: string,
    provider: IntegrationProviderType,
  ) {
    const profile = await this.memoryProfiles.getOrCreate(tenant, {
      entityType: MemoryProfileEntityType.ASSISTANT,
      entityId: assistantId,
    });
    await this.memoryEntries.create(tenant, profile.id, {
      content: `[${provider}] ${content}`,
      entryType: MemoryEntryType.OBSERVATION,
      source: `integration:${provider.toLowerCase()}`,
    });
  }

  private async writeOrgMemory(
    tenant: TenantContext,
    content: string,
    provider: IntegrationProviderType,
  ) {
    const profile = await this.memoryProfiles.getOrCreate(tenant, {
      entityType: MemoryProfileEntityType.ORGANIZATION,
      entityId: tenant.organizationId,
    });
    await this.memoryEntries.create(tenant, profile.id, {
      content: `[${provider}] ${content}`,
      entryType: MemoryEntryType.OBSERVATION,
      source: `integration:${provider.toLowerCase()}`,
    });
  }

  private async buildTenant(organizationId: string, userId?: string): Promise<TenantContext> {
    const uid = userId ?? 'integration@system';
    return {
      organizationId,
      userId: uid,
      email: 'integration@system',
      role: 'USER' as never,
      organizationRole: 'OPERATOR' as never,
    };
  }
}
