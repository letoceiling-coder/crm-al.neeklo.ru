import { Module, forwardRef } from '@nestjs/common';
import { SecretsModule } from '../secrets/secrets.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { MemoryModule } from '../memory/memory.module';
import { AssistantsModule } from '../assistants/assistants.module';
import { IntegrationController } from './integration.controller';
import { IntegrationWebhookController } from './integration-webhook.controller';
import { IntegrationProviderService } from './integration-provider.service';
import { IntegrationAccountService } from './integration-account.service';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { IntegrationEventService } from './integration-event.service';
import { AssistantChannelService } from './assistant-channel.service';
import { IntegrationInboundService } from './integration-inbound.service';
import { TelegramAdapter } from './providers/telegram.adapter';
import { MaxAdapter } from './providers/max.adapter';
import { EmailAdapter } from './providers/email.adapter';
import { WebhookAdapter } from './providers/webhook.adapter';
import { Bitrix24Adapter } from './providers/bitrix24.adapter';
import { AmoCrmAdapter } from './providers/amocrm.adapter';
import { GoogleAdapter } from './providers/google.adapter';
import { IntegrationToolService } from './integration-tool.service';

@Module({  imports: [
    SecretsModule,
    forwardRef(() => WorkflowsModule),
    forwardRef(() => MemoryModule),
    forwardRef(() => AssistantsModule),
  ],
  controllers: [IntegrationController, IntegrationWebhookController],
  providers: [
    IntegrationProviderService,
    IntegrationAccountService,
    ConversationService,
    MessageService,
    IntegrationEventService,
    AssistantChannelService,
    IntegrationInboundService,
    TelegramAdapter,
    MaxAdapter,
    EmailAdapter,
    WebhookAdapter,
    Bitrix24Adapter,
    AmoCrmAdapter,
    GoogleAdapter,
    IntegrationToolService,
  ],
  exports: [
    IntegrationAccountService,
    IntegrationEventService,
    ConversationService,
    AssistantChannelService,
    IntegrationToolService,
  ],})
export class IntegrationsModule {}
