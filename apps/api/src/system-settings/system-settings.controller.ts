import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentProviderType } from '@prisma/client';
import { Request } from 'express';
import { AdminGuard } from '../common/guards/admin.guard';
import { SystemIntegrationsService } from './system-integrations.service';

type AuthRequest = Request & { user: { id: string } };

@ApiTags('System Settings')
@ApiBearerAuth()
@Controller('v1/system/settings')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class SystemSettingsController {
  constructor(private integrations: SystemIntegrationsService) {}

  @Get('general')
  getGeneral() {
    return this.integrations.getGeneralSettings();
  }

  @Patch('general')
  updateGeneral(@Body() body: { publicUrl: string }, @Req() req: AuthRequest) {
    return this.integrations.updateGeneral(body, req.user.id);
  }

  @Get('payments')
  listPayments() {
    return this.integrations.listPaymentProviders();
  }

  @Patch('payments/:provider')
  updatePayment(
    @Param('provider') provider: PaymentProviderType,
    @Body() body: { isEnabled?: boolean; testMode?: boolean; shopId?: string; secretKey?: string },
    @Req() req: AuthRequest,
  ) {
    return this.integrations.updatePaymentProvider(provider, body, req.user.id);
  }

  @Post('payments/:provider/default')
  setDefaultPayment(@Param('provider') provider: PaymentProviderType, @Req() req: AuthRequest) {
    return this.integrations.setDefaultPaymentProvider(provider, req.user.id);
  }

  @Post('payments/:provider/test')
  @ApiOperation({ summary: 'Test payment provider connection' })
  testPayment(@Param('provider') provider: PaymentProviderType, @Req() req: AuthRequest) {
    return this.integrations.testPaymentProvider(provider, req.user.id);
  }

  @Post('payments/yookassa/test-payment')
  @ApiOperation({ summary: 'Create YooKassa test payment (1 RUB)' })
  createTestPayment(@Req() req: AuthRequest) {
    return this.integrations.createTestPayment(req.user.id);
  }

  @Get('parser')
  getParser() {
    return this.integrations.getParserSettings();
  }

  @Patch('parser')
  updateParser(
    @Body() body: { baseUrl?: string; apiKey?: string },
    @Req() req: AuthRequest,
  ) {
    return this.integrations.updateParserSettings(body, req.user.id);
  }

  @Get('email')
  getEmail() {
    return this.integrations.getSmtpSettings();
  }

  @Patch('email')
  updateEmail(
    @Body() body: { host: string; port: number; tls: boolean; user: string; from: string; password?: string },
    @Req() req: AuthRequest,
  ) {
    return this.integrations.updateSmtp(body, req.user.id);
  }

  @Post('email/test-connection')
  testEmailConnection() {
    return this.integrations.testSmtpConnection();
  }

  @Post('email/test-send')
  sendTestEmail(@Body() body: { to: string }, @Req() req: AuthRequest) {
    return this.integrations.sendTestEmail(body.to, req.user.id);
  }

  @Get('alerts')
  getAlerts() {
    return this.integrations.getAlertSettings();
  }

  @Patch('alerts')
  updateAlerts(
    @Body() body: {
      alertEmail?: string;
      queueAlerts?: boolean;
      paymentAlerts?: boolean;
      storageAlerts?: boolean;
      smtpAlerts?: boolean;
      securityAlerts?: boolean;
      parserAlerts?: boolean;
      telegramEnabled?: boolean;
      telegramChatId?: string;
      telegramBotToken?: string;
    },
    @Req() req: AuthRequest,
  ) {
    return this.integrations.updateAlertSettings(body, req.user.id);
  }

  @Post('alerts/test')
  testAlert(@Req() req: AuthRequest) {
    return this.integrations.sendTestAlert(req.user.id);
  }

  @Post('alerts/test-telegram')
  @ApiOperation({ summary: 'Send test Telegram alert (optional channel)' })
  testTelegramAlert() {
    return this.integrations.testTelegramAlert();
  }

  @Get('registration')
  getRegistration() {
    return this.integrations.getRegistrationSettings();
  }

  @Patch('registration')
  updateRegistration(
    @Body() body: {
      enabled?: boolean;
      inviteOnly?: boolean;
      defaultPlan?: string;
      requireEmailVerification?: boolean;
      autoCreateOrganization?: boolean;
    },
    @Req() req: AuthRequest,
  ) {
    return this.integrations.updateRegistrationSettings(body, req.user.id);
  }

  @Get('billing')
  getBilling() {
    return this.integrations.getBillingSettings();
  }

  @Patch('billing')
  updateBilling(
    @Body() body: {
      defaultCurrency?: string;
      invoicePrefix?: string;
      paymentTimeoutHours?: number;
      gracePeriodDays?: number;
      trialDays?: number;
    },
    @Req() req: AuthRequest,
  ) {
    return this.integrations.updateBillingSettings(body, req.user.id);
  }

  @Get('health')
  integrationHealth() {
    return this.integrations.getIntegrationHealth();
  }
}

@ApiTags('System Launch')
@ApiBearerAuth()
@Controller('v1/system/launch')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class SystemLaunchController {
  constructor(private integrations: SystemIntegrationsService) {}

  @Get()
  @ApiOperation({ summary: 'Launch readiness center' })
  getLaunchReadiness() {
    return this.integrations.getLaunchReadiness();
  }
}

@ApiTags('System Settings')
@Controller('v1/system/settings/public')
export class SystemSettingsPublicController {
  constructor(private integrations: SystemIntegrationsService) {}

  @Get('registration')
  registrationStatus() {
    return this.integrations.getRegistrationSettings().then((r) => ({ enabled: r.enabled }));
  }
}
