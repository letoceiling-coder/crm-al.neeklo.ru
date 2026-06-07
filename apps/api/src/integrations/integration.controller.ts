import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IntegrationProviderType, MessageDirection } from '@prisma/client';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { IntegrationProviderService } from './integration-provider.service';
import { IntegrationAccountService } from './integration-account.service';
import { ConversationService } from './conversation.service';
import { IntegrationEventService } from './integration-event.service';
import { AssistantChannelService } from './assistant-channel.service';
import { IntegrationInboundService } from './integration-inbound.service';
import { MessageService } from './message.service';
import { WebhookAdapter } from './providers/webhook.adapter';
import {
  CreateIntegrationAccountDto,
  UpdateIntegrationAccountDto,
  BindAssistantChannelDto,
  SendMessageDto,
  ListConversationsQueryDto,
  OutboundWebhookDto,
} from './dto/integration.dto';

@ApiTags('Integrations')
@ApiBearerAuth()
@Controller('v1/integrations')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class IntegrationController {
  constructor(
    private providers: IntegrationProviderService,
    private accounts: IntegrationAccountService,
    private conversations: ConversationService,
    private events: IntegrationEventService,
    private channels: AssistantChannelService,
    private inbound: IntegrationInboundService,
    private messages: MessageService,
    private webhookAdapter: WebhookAdapter,
  ) {}

  @Get('providers')
  @ApiOperation({ summary: 'List integration providers' })
  listProviders() {
    return this.providers.list();
  }

  @Get('providers/:provider')
  @ApiOperation({ summary: 'Get provider by type' })
  getProvider(@Param('provider') provider: IntegrationProviderType) {
    return this.providers.findByType(provider);
  }

  @Get('accounts')
  @ApiOperation({ summary: 'List integration accounts' })
  listAccounts(
    @CurrentTenant() tenant: TenantContext,
    @Query('provider') provider?: IntegrationProviderType,
  ) {
    return this.accounts.list(tenant, provider);
  }

  @Post('accounts')
  @ApiOperation({ summary: 'Create integration account' })
  createAccount(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateIntegrationAccountDto) {
    return this.accounts.create(tenant, dto);
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: 'Get integration account' })
  getAccount(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.accounts.findOne(tenant, id);
  }

  @Patch('accounts/:id')
  @ApiOperation({ summary: 'Update integration account' })
  updateAccount(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationAccountDto,
  ) {
    return this.accounts.update(tenant, id, dto);
  }

  @Delete('accounts/:id')
  @ApiOperation({ summary: 'Delete integration account' })
  deleteAccount(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.accounts.remove(tenant, id);
  }

  @Post('accounts/:id/outbound')
  @ApiOperation({ summary: 'Send outbound webhook' })
  async sendOutbound(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: OutboundWebhookDto,
  ) {
    const account = await this.accounts.findOne(tenant, id);
    const secret = await this.accounts.getSecret(id, tenant.organizationId);
    const settings = { ...(account?.settings as object), outboundUrl: dto.url };
    return this.webhookAdapter.sendOutbound(settings, secret, dto.body ?? {}, dto.method ?? 'POST');
  }

  @Get('events')
  @ApiOperation({ summary: 'List integration events' })
  listEvents(
    @CurrentTenant() tenant: TenantContext,
    @Query('accountId') accountId?: string,
  ) {
    return this.events.list(tenant.organizationId, accountId);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations (unified inbox)' })
  listConversations(@CurrentTenant() tenant: TenantContext, @Query() query: ListConversationsQueryDto) {
    return this.conversations.list(tenant, query);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation with messages' })
  getConversation(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.conversations.findOne(tenant, id);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send outbound message in conversation' })
  async sendMessage(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    const conv = await this.conversations.findOne(tenant, id);
    if (!conv?.integrationAccount) throw new Error('No integration account');
    const account = await this.accounts.findOne(tenant, conv.integrationAccount.id);
    await this.inbound.sendReply(
      account!,
      conv.externalId,
      dto.content,
      conv.channel,
    );
    return this.messages.create({
      conversationId: id,
      direction: MessageDirection.OUTBOUND,
      content: dto.content,
      attachments: dto.attachments,
    });
  }

  @Get('assistants/:assistantId/channels')
  @ApiOperation({ summary: 'List assistant channel bindings' })
  listAssistantChannels(
    @CurrentTenant() tenant: TenantContext,
    @Param('assistantId') assistantId: string,
  ) {
    return this.channels.listForAssistant(tenant, assistantId);
  }

  @Post('assistants/:assistantId/channels')
  @ApiOperation({ summary: 'Bind integration account to assistant' })
  bindChannel(
    @CurrentTenant() tenant: TenantContext,
    @Param('assistantId') assistantId: string,
    @Body() dto: BindAssistantChannelDto,
  ) {
    return this.channels.bind(tenant, assistantId, dto);
  }

  @Delete('assistants/:assistantId/channels/:channelId')
  @ApiOperation({ summary: 'Unbind assistant channel' })
  unbindChannel(
    @CurrentTenant() tenant: TenantContext,
    @Param('assistantId') assistantId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.channels.unbind(tenant, assistantId, channelId);
  }
}
