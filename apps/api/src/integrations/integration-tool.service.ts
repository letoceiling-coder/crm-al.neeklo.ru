import { Injectable, NotFoundException } from '@nestjs/common';
import { IntegrationProviderType, MessageDirection, ConversationChannel } from '@prisma/client';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { IntegrationAccountService } from './integration-account.service';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { TelegramAdapter } from './providers/telegram.adapter';
import { MaxAdapter } from './providers/max.adapter';
import { EmailAdapter } from './providers/email.adapter';

const MESSAGING_SLUGS = new Set(['telegram', 'max', 'email']);

const SLUG_TO_PROVIDER: Record<string, IntegrationProviderType> = {
  telegram: IntegrationProviderType.TELEGRAM,
  max: IntegrationProviderType.MAX,
  email: IntegrationProviderType.EMAIL,
};

const SLUG_TO_CHANNEL: Record<string, ConversationChannel> = {
  telegram: ConversationChannel.TELEGRAM,
  max: ConversationChannel.MAX,
  email: ConversationChannel.EMAIL,
};

@Injectable()
export class IntegrationToolService {
  constructor(
    private accounts: IntegrationAccountService,
    private conversations: ConversationService,
    private messages: MessageService,
    private telegram: TelegramAdapter,
    private max: MaxAdapter,
    private email: EmailAdapter,
  ) {}

  isMessagingSlug(slug: string) {
    return MESSAGING_SLUGS.has(slug);
  }

  async testMessagingTool(tenant: TenantContext, slug: string, integrationAccountId: string) {
    await this.accounts.assertOwned(integrationAccountId, tenant.organizationId);
    return { ok: true, provider: slug, integrationAccountId };
  }

  async executeMessagingTool(
    tenant: TenantContext,
    slug: string,
    settings: Record<string, unknown>,
    input: Record<string, unknown>,
    assistantId?: string,
  ) {
    const accountId = String(settings.integrationAccountId ?? input.integrationAccountId ?? '');
    if (!accountId) throw new Error('integrationAccountId required in tool settings or input');

    const account = await this.accounts.findOne(tenant, accountId);
    if (!account) throw new NotFoundException('Integration account not found');

    const secret = await this.accounts.getSecret(accountId, tenant.organizationId);
    const provider = SLUG_TO_PROVIDER[slug];
    const channel = SLUG_TO_CHANNEL[slug];

    const recipient = String(
      input.to ?? input.chatId ?? input.userId ?? input.email ?? settings.chatId ?? settings.defaultTo ?? '',
    );
    const text = String(input.message ?? input.text ?? input.body ?? input.content ?? '');

    if (!recipient) throw new Error('Recipient required (to, chatId, userId, or email)');
    if (!text) throw new Error('Message text required');

    const conversation = await this.conversations.upsert({
      organizationId: tenant.organizationId,
      channel,
      externalId: recipient,
      assistantId,
      integrationAccountId: accountId,
    });

    let sendResult: Record<string, unknown>;
    switch (provider) {
      case IntegrationProviderType.TELEGRAM:
        sendResult = await this.telegram.sendMessage(secret, recipient, text);
        break;
      case IntegrationProviderType.MAX:
        sendResult = await this.max.sendMessage(secret, recipient, text, account.settings as Record<string, unknown>);
        break;
      case IntegrationProviderType.EMAIL:
        sendResult = await this.email.sendMessage(
          account.settings as Record<string, unknown>,
          secret,
          recipient,
          text,
        );
        break;
      default:
        throw new Error(`Unsupported messaging provider: ${slug}`);
    }

    const message = await this.messages.create({
      conversationId: conversation.id,
      direction: MessageDirection.OUTBOUND,
      content: text,
      metadata: { toolSlug: slug, sendResult },
    });

    return {
      ok: true,
      provider: slug,
      conversationId: conversation.id,
      messageId: message.id,
      recipient,
      sendResult,
    };
  }
}
