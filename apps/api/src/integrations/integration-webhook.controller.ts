import { Body, Controller, Headers, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { IntegrationAccountService } from './integration-account.service';
import { IntegrationInboundService } from './integration-inbound.service';
import { verifyWebhookSignature } from './integration-signature.util';
import type { Request } from 'express';

@ApiTags('Integration Webhooks')
@Controller('v1/integrations')
export class IntegrationWebhookController {
  constructor(
    private accounts: IntegrationAccountService,
    private inbound: IntegrationInboundService,
  ) {}

  @Public()
  @Post('telegram/webhook/:accountId')
  @ApiOperation({ summary: 'Telegram bot webhook' })
  async telegramWebhook(
    @Param('accountId') accountId: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
    @Req() req?: Request,
  ) {
    const account = await this.accounts.findForWebhook(accountId);
    const settings = (account.settings ?? {}) as { secretToken?: string };
    if (settings.secretToken && settings.secretToken !== secretToken) {
      throw new UnauthorizedException('Invalid Telegram secret token');
    }
    return this.inbound.handleInbound(account, body);
  }

  @Public()
  @Post('max/webhook/:accountId')
  @ApiOperation({ summary: 'MAX bot webhook' })
  async maxWebhook(
    @Param('accountId') accountId: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-signature') signature?: string,
    @Req() req?: Request,
  ) {
    const account = await this.accounts.findForWebhook(accountId);
    this.assertSignature(account, req, signature);
    return this.inbound.handleInbound(account, body, { 'x-signature': signature ?? '' });
  }

  @Public()
  @Post('email/webhook/:accountId')
  @ApiOperation({ summary: 'Inbound email webhook (IMAP relay)' })
  async emailWebhook(
    @Param('accountId') accountId: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-signature') signature?: string,
    @Req() req?: Request,
  ) {
    const account = await this.accounts.findForWebhook(accountId);
    this.assertSignature(account, req, signature);
    return this.inbound.handleInbound(account, body);
  }

  @Public()
  @Post('webhook/inbound/:accountId')
  @ApiOperation({ summary: 'Generic inbound webhook' })
  async genericWebhook(
    @Param('accountId') accountId: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-signature') signature?: string,
    @Req() req?: Request,
  ) {
    const account = await this.accounts.findForWebhook(accountId);
    this.assertSignature(account, req, signature);
    return this.inbound.handleInbound(account, body, { 'x-signature': signature ?? '' });
  }

  @Public()
  @Post('bitrix24/webhook/:accountId')
  @ApiOperation({ summary: 'Bitrix24 outbound webhook' })
  async bitrixWebhook(@Param('accountId') accountId: string, @Body() body: Record<string, unknown>) {
    const account = await this.accounts.findForWebhook(accountId);
    return this.inbound.handleInbound(account, body);
  }

  @Public()
  @Post('amocrm/webhook/:accountId')
  @ApiOperation({ summary: 'amoCRM webhook' })
  async amoWebhook(@Param('accountId') accountId: string, @Body() body: Record<string, unknown>) {
    const account = await this.accounts.findForWebhook(accountId);
    return this.inbound.handleInbound(account, body);
  }

  private assertSignature(
    account: { webhookSecret: string | null },
    req?: Request,
    signature?: string,
  ) {
    if (!account.webhookSecret) return;
    const raw = (req as Request & { rawBody?: string })?.rawBody ?? JSON.stringify(req?.body ?? {});
    if (!verifyWebhookSignature(account.webhookSecret, raw, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
