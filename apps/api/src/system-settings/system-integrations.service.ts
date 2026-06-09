import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
import {
  AuditAction,
  PaymentProviderType,
  SystemSettingCategory,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecretEncryptionService } from '../secrets/secret-encryption.service';
import { SystemSettingsService } from './system-settings.service';
import { SystemHealthService } from '../system/system-health.service';
import { SystemDependenciesService } from '../system/system-dependencies.service';
import { SystemQueueService } from '../system/system-queue.service';
import {
  PLATFORM_ORG_ID,
  PaymentProviderConfigValue,
  ParserConfigValue,
  SECRET_KEYS,
  SETTING_KEYS,
  SmtpConfigValue,
  TelegramBotConfigValue,
} from './system-settings.constants';
import { buildSmtpTransportOptions } from '../common/utils/smtp-transport.util';

const PROVIDER_LABELS: Record<PaymentProviderType, string> = {
  YOOKASSA: 'YooKassa',
  STRIPE: 'Stripe',
  ROBOKASSA: 'Robokassa',
  CLOUDPAYMENTS: 'CloudPayments',
};

@Injectable()
export class SystemIntegrationsService {
  private readonly logger = new Logger(SystemIntegrationsService.name);

  constructor(
    private prisma: PrismaService,
    private settings: SystemSettingsService,
    private secrets: SecretEncryptionService,
    private config: ConfigService,
    private health: SystemHealthService,
    private dependencies: SystemDependenciesService,
    private queues: SystemQueueService,
  ) {}

  async getGeneralSettings() {
    return {
      publicUrl: await this.settings.getPublicUrl(),
    };
  }

  async updateGeneral(dto: { publicUrl: string }, userId: string) {
    await this.settings.set(SETTING_KEYS.APP_PUBLIC_URL, dto.publicUrl, userId, {
      category: SystemSettingCategory.GENERAL,
    });
    return this.getGeneralSettings();
  }

  async listPaymentProviders() {
    const publicUrl = await this.settings.getPublicUrl();
    const mockMode = await this.settings.isPaymentMockMode();
    const rows = await this.prisma.paymentProvider.findMany({
      where: { provider: PaymentProviderType.YOOKASSA },
      orderBy: { provider: 'asc' },
    });

    return rows.map((row) => {
      const cfg = (row.config ?? {}) as PaymentProviderConfigValue;
      const webhookPath = cfg.webhookPath ?? `/api/v1/payments/webhook/${row.provider.toLowerCase()}`;
      const returnPath = cfg.returnPath ?? '/billing/invoices?paid=1';
      return {
        provider: row.provider,
        name: cfg.displayName ?? PROVIDER_LABELS[row.provider],
        isEnabled: row.isEnabled,
        isDefault: row.isDefault,
        testMode: cfg.testMode ?? mockMode,
        shopId: cfg.shopId ?? '',
        hasSecretKey: !!cfg.secretKeySecretId,
        webhookUrl: `${publicUrl}${webhookPath}`,
        returnUrl: `${publicUrl}${returnPath}`,
      };
    });
  }

  async updatePaymentProvider(
    provider: PaymentProviderType,
    dto: {
      isEnabled?: boolean;
      testMode?: boolean;
      shopId?: string;
      secretKey?: string;
    },
    userId: string,
  ) {
    const row = await this.prisma.paymentProvider.findUnique({ where: { provider } });
    if (!row) throw new BadRequestException('Provider not found');

    const cfg = { ...(row.config as PaymentProviderConfigValue) };
    if (dto.testMode !== undefined) cfg.testMode = dto.testMode;
    if (dto.shopId !== undefined) cfg.shopId = dto.shopId;

    if (dto.secretKey?.trim()) {
      const secretId = await this.secrets.upsertByKey(
        PLATFORM_ORG_ID,
        SECRET_KEYS.paymentSecret(provider),
        dto.secretKey.trim(),
      );
      cfg.secretKeySecretId = secretId;
    }

    await this.prisma.paymentProvider.update({
      where: { provider },
      data: {
        isEnabled: dto.isEnabled ?? row.isEnabled,
        config: cfg as object,
      },
    });

    if (dto.testMode !== undefined) {
      await this.settings.set(SETTING_KEYS.PAYMENT_MOCK_MODE, dto.testMode, userId, {
        category: SystemSettingCategory.PAYMENT,
        auditAction: AuditAction.PAYMENT_PROVIDER_UPDATED,
      });
    } else {
      await this.settings.set(`payment.provider.${provider}`, { updatedAt: new Date().toISOString() }, userId, {
        category: SystemSettingCategory.PAYMENT,
        auditAction: AuditAction.PAYMENT_PROVIDER_UPDATED,
      });
    }

    return this.listPaymentProviders();
  }

  async setDefaultPaymentProvider(provider: PaymentProviderType, userId: string) {
    await this.prisma.$transaction([
      this.prisma.paymentProvider.updateMany({ data: { isDefault: false } }),
      this.prisma.paymentProvider.update({ where: { provider }, data: { isDefault: true, isEnabled: true } }),
    ]);
    await this.settings.set(`payment.default_provider`, provider, userId, {
      category: SystemSettingCategory.PAYMENT,
      auditAction: AuditAction.PAYMENT_PROVIDER_UPDATED,
    });
    return this.listPaymentProviders();
  }

  async testPaymentProvider(provider: PaymentProviderType, userId?: string) {
    if (provider !== PaymentProviderType.YOOKASSA) {
      return { ok: false, message: 'Only YooKassa is supported' };
    }

    const creds = await this.getPaymentCredentials(provider);
    if (!creds.shopId || !creds.secretKey) {
      return { ok: false, message: 'Shop ID and Secret Key required' };
    }

    try {
      await axios.get('https://api.yookassa.ru/v3/me', {
        auth: { username: creds.shopId, password: creds.secretKey },
        timeout: 15_000,
      });
      await this.settings.set(SETTING_KEYS.LAUNCH_PAYMENT_TEST, true, userId ?? undefined, {
        category: SystemSettingCategory.LAUNCH,
      });
      return { ok: true, message: 'YooKassa connection successful' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Connection failed';
      return { ok: false, message: msg };
    }
  }

  async createTestPayment(userId: string) {
    const creds = await this.getPaymentCredentials(PaymentProviderType.YOOKASSA);
    if (!creds.shopId || !creds.secretKey) {
      return { ok: false, message: 'Shop ID and Secret Key required' };
    }
    if (creds.mockMode) {
      return { ok: false, message: 'Disable test mode before creating a real test payment' };
    }

    const publicUrl = await this.settings.getPublicUrl();
    const idempotenceKey = `test-${Date.now()}-${userId.slice(0, 8)}`;

    try {
      const { data } = await axios.post(
        'https://api.yookassa.ru/v3/payments',
        {
          amount: { value: '1.00', currency: 'RUB' },
          capture: true,
          confirmation: {
            type: 'redirect',
            return_url: `${publicUrl}/billing/invoices?paid=1`,
          },
          description: 'AI Gateway — test payment',
        },
        {
          auth: { username: creds.shopId, password: creds.secretKey },
          headers: { 'Idempotence-Key': idempotenceKey, 'Content-Type': 'application/json' },
          timeout: 20_000,
        },
      );

      await this.settings.set(SETTING_KEYS.LAUNCH_PAYMENT_TEST, true, userId, {
        category: SystemSettingCategory.LAUNCH,
      });

      return {
        ok: true,
        message: 'Test payment created',
        paymentId: data.id,
        confirmationUrl: data.confirmation?.confirmation_url ?? null,
        status: data.status,
      };
    } catch (e) {
      const msg = axios.isAxiosError(e)
        ? JSON.stringify(e.response?.data ?? e.message)
        : e instanceof Error
          ? e.message
          : 'Test payment failed';
      return { ok: false, message: msg };
    }
  }

  async getParserSettings() {
    const cfg = await this.resolveParserConfig();
    const hasKey = !!(cfg.apiKey || this.config.get('PARSER_API_KEY'));
    return {
      baseUrl: cfg.baseUrl,
      hasApiKey: hasKey,
      configured: hasKey,
    };
  }

  async updateParserSettings(
    dto: { baseUrl?: string; apiKey?: string },
    userId: string,
  ) {
    const current = await this.settings.getJson<ParserConfigValue>(
      SETTING_KEYS.PARSER_CONFIG,
      { baseUrl: 'https://pars-site.neeklo.ru', apiKeySecretId: null },
    );

    let apiKeySecretId = current.apiKeySecretId;
    if (dto.apiKey?.trim()) {
      apiKeySecretId = await this.secrets.upsertByKey(
        PLATFORM_ORG_ID,
        SECRET_KEYS.parserApiKey,
        dto.apiKey.trim(),
      );
    }

    await this.settings.set(
      SETTING_KEYS.PARSER_CONFIG,
      {
        baseUrl: dto.baseUrl?.trim() || current.baseUrl || 'https://pars-site.neeklo.ru',
        apiKeySecretId,
      },
      userId,
      { category: SystemSettingCategory.GENERAL },
    );

    return this.getParserSettings();
  }

  async getParserApiKey(): Promise<string> {
    const cfg = await this.resolveParserConfig();
    return cfg.apiKey;
  }

  async getParserBaseUrl(): Promise<string> {
    const cfg = await this.resolveParserConfig();
    return cfg.baseUrl;
  }

  private async resolveParserConfig(): Promise<{ baseUrl: string; apiKey: string }> {
    const db = await this.settings.getJson<ParserConfigValue>(
      SETTING_KEYS.PARSER_CONFIG,
      { baseUrl: 'https://pars-site.neeklo.ru', apiKeySecretId: null },
    );

    let apiKey = '';
    if (db.apiKeySecretId) {
      try {
        apiKey = (await this.secrets.getSecret(db.apiKeySecretId, PLATFORM_ORG_ID)) ?? '';
      } catch {
        apiKey = '';
      }
    }
    if (!apiKey) {
      apiKey = this.config.get('PARSER_API_KEY', '') ?? '';
    }

    return {
      baseUrl: db.baseUrl || this.config.get('PARSER_BASE_URL', 'https://pars-site.neeklo.ru'),
      apiKey,
    };
  }

  async getPaymentCredentials(provider: PaymentProviderType) {
    const row = await this.prisma.paymentProvider.findUnique({ where: { provider } });
    const cfg = (row?.config ?? {}) as PaymentProviderConfigValue;
    let secretKey = '';

    if (cfg.secretKeySecretId) {
      try {
        secretKey = (await this.secrets.getSecret(cfg.secretKeySecretId, PLATFORM_ORG_ID)) ?? '';
      } catch {
        secretKey = '';
      }
    }

    if (!secretKey) {
      secretKey = this.config.get('YOOKASSA_SECRET_KEY', '');
    }

    const shopId = cfg.shopId || this.config.get('YOOKASSA_SHOP_ID', '');
    const mockMode = await this.settings.isPaymentMockMode();

    return { shopId, secretKey, mockMode: mockMode || !shopId };
  }

  async getSmtpSettings() {
    const cfg = await this.resolveSmtpConfig();
    const lastSuccess = await this.settings.getJson<string | null>(SETTING_KEYS.EMAIL_LAST_SUCCESS, null);
    const lastError = await this.settings.getJson<{ at: string; message: string } | null>(SETTING_KEYS.EMAIL_LAST_ERROR, null);

    return {
      host: cfg.host,
      port: cfg.port,
      tls: cfg.tls,
      secure: cfg.tls,
      user: cfg.user,
      username: cfg.user,
      from: cfg.from,
      fromEmail: cfg.from,
      hasPassword: !!cfg.password,
      configured: !!(cfg.host && cfg.user && cfg.password),
      lastSuccessAt: lastSuccess,
      lastError,
    };
  }

  async updateSmtp(
    dto: { host: string; port: number; tls: boolean; user: string; from: string; password?: string },
    userId: string,
  ) {
    const current = await this.settings.getJson<SmtpConfigValue>(SETTING_KEYS.SMTP_CONFIG, {
      host: '',
      port: 587,
      tls: true,
      user: '',
      from: 'noreply@crm-al.neeklo.ru',
      passwordSecretId: null,
    });

    let passwordSecretId = current.passwordSecretId;
    if (dto.password?.trim()) {
      passwordSecretId = await this.secrets.upsertByKey(
        PLATFORM_ORG_ID,
        SECRET_KEYS.smtpPassword,
        dto.password.trim(),
      );
    }

    const next: SmtpConfigValue = {
      host: dto.host,
      port: dto.port,
      tls: dto.tls,
      user: dto.user,
      from: dto.from,
      passwordSecretId,
    };

    await this.settings.set(SETTING_KEYS.SMTP_CONFIG, next, userId, {
      category: SystemSettingCategory.EMAIL,
      auditAction: AuditAction.SMTP_UPDATED,
    });

    return this.getSmtpSettings();
  }

  async testSmtpConnection() {
    const cfg = await this.resolveSmtpConfig();
    if (!cfg.host || !cfg.user) {
      return { ok: false, message: 'SMTP not configured' };
    }

    try {
      const transport = nodemailer.createTransport(buildSmtpTransportOptions(cfg));
      await transport.verify();
      return { ok: true, message: 'SMTP connection verified' };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'SMTP verify failed';
      await this.recordEmailError(message);
      return { ok: false, message };
    }
  }

  async sendTestEmail(to: string, userId: string) {
    const cfg = await this.resolveSmtpConfig();
    if (!cfg.host || !cfg.user || !cfg.password) {
      throw new BadRequestException('SMTP not fully configured');
    }

    try {
      const transport = nodemailer.createTransport(buildSmtpTransportOptions(cfg));
      const info = await transport.sendMail({
        from: cfg.from,
        to,
        subject: 'AI Gateway — тестовое письмо',
        html: '<p>SMTP настроен корректно.</p>',
      });
      await this.settings.set(SETTING_KEYS.EMAIL_LAST_SUCCESS, new Date().toISOString(), userId, {
        category: SystemSettingCategory.EMAIL,
      });
      await this.settings.set(SETTING_KEYS.LAUNCH_EMAIL_TEST, true, userId, {
        category: SystemSettingCategory.LAUNCH,
      });
      return { ok: true, messageId: info.messageId };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Send failed';
      await this.recordEmailError(message);
      throw new BadRequestException(message);
    }
  }

  async resolveSmtpConfig(): Promise<SmtpConfigValue & { password: string }> {
    const db = await this.settings.getJson<SmtpConfigValue>(SETTING_KEYS.SMTP_CONFIG, {
      host: '',
      port: 587,
      tls: true,
      user: '',
      from: 'noreply@crm-al.neeklo.ru',
      passwordSecretId: null,
    });

    let password = '';
    if (db.passwordSecretId) {
      try {
        password = (await this.secrets.getSecret(db.passwordSecretId, PLATFORM_ORG_ID)) ?? '';
      } catch {
        password = '';
      }
    }

    if (!db.host) {
      return {
        ...db,
        host: this.config.get('SMTP_HOST', ''),
        port: Number(this.config.get('SMTP_PORT', 587)),
        tls: this.config.get('SMTP_TLS', 'true') === 'true',
        user: this.config.get('SMTP_USER', ''),
        from: this.config.get('SMTP_FROM', db.from),
        password: password || this.config.get('SMTP_PASSWORD', ''),
      };
    }

    return { ...db, password: password || this.config.get('SMTP_PASSWORD', '') };
  }

  async getAlertSettings() {
    const botCfg = await this.settings.getJson<TelegramBotConfigValue>(SETTING_KEYS.TELEGRAM_BOT_CONFIG, {
      botTokenSecretId: null,
      webhookRegisteredAt: null,
      webhookOk: false,
      lastWebhookError: null,
    });
    let hasTelegramBotToken = false;
    if (botCfg.botTokenSecretId) {
      try {
        const token = await this.secrets.getSecret(botCfg.botTokenSecretId, PLATFORM_ORG_ID);
        hasTelegramBotToken = !!token;
      } catch {
        hasTelegramBotToken = false;
      }
    }

    return {
      alertEmail: await this.settings.getString(SETTING_KEYS.ALERTS_EMAIL, this.config.get('ALERT_EMAIL', '')),
      queueAlerts: await this.settings.getBoolean(SETTING_KEYS.ALERTS_QUEUE, true),
      paymentAlerts: await this.settings.getBoolean(SETTING_KEYS.ALERTS_PAYMENT, true),
      storageAlerts: await this.settings.getBoolean(SETTING_KEYS.ALERTS_STORAGE, true),
      smtpAlerts: await this.settings.getBoolean(SETTING_KEYS.ALERTS_SMTP, true),
      securityAlerts: await this.settings.getBoolean(SETTING_KEYS.ALERTS_SECURITY, true),
      parserAlerts: await this.settings.getBoolean(SETTING_KEYS.ALERTS_PARSER, true),
      telegramEnabled: await this.settings.getBoolean(SETTING_KEYS.ALERTS_TELEGRAM, false),
      hasTelegramBotToken,
    };
  }

  async updateAlertSettings(
    dto: {
      alertEmail?: string;
      queueAlerts?: boolean;
      paymentAlerts?: boolean;
      storageAlerts?: boolean;
      smtpAlerts?: boolean;
      securityAlerts?: boolean;
      parserAlerts?: boolean;
      telegramEnabled?: boolean;
    },
    userId: string,
  ) {
    if (dto.alertEmail !== undefined) {
      await this.settings.set(SETTING_KEYS.ALERTS_EMAIL, dto.alertEmail, userId, {
        category: SystemSettingCategory.ALERT,
        auditAction: AuditAction.ALERT_UPDATED,
      });
    }
    const boolMap: Array<[boolean | undefined, string]> = [
      [dto.queueAlerts, SETTING_KEYS.ALERTS_QUEUE],
      [dto.paymentAlerts, SETTING_KEYS.ALERTS_PAYMENT],
      [dto.storageAlerts, SETTING_KEYS.ALERTS_STORAGE],
      [dto.smtpAlerts, SETTING_KEYS.ALERTS_SMTP],
      [dto.securityAlerts, SETTING_KEYS.ALERTS_SECURITY],
      [dto.parserAlerts, SETTING_KEYS.ALERTS_PARSER],
      [dto.telegramEnabled, SETTING_KEYS.ALERTS_TELEGRAM],
    ];
    for (const [val, key] of boolMap) {
      if (val !== undefined) {
        await this.settings.set(key, val, userId, {
          category: SystemSettingCategory.ALERT,
          auditAction: AuditAction.ALERT_UPDATED,
        });
      }
    }

    return this.getAlertSettings();
  }

  async sendTestAlert(userId: string) {
    const to = await this.settings.getString(SETTING_KEYS.ALERTS_EMAIL, this.config.get('ALERT_EMAIL', ''));
    if (!to) throw new BadRequestException('Alert email not configured');
    return this.sendTestEmail(to, userId);
  }

  async getRegistrationSettings() {
    return {
      enabled: await this.settings.isRegistrationEnabled(),
      inviteOnly: await this.settings.getBoolean(SETTING_KEYS.REGISTRATION_INVITE_ONLY, false),
      defaultPlan: await this.settings.getString(SETTING_KEYS.REGISTRATION_DEFAULT_PLAN, 'FREE'),
      requireEmailVerification: await this.settings.getBoolean(SETTING_KEYS.REGISTRATION_REQUIRE_EMAIL_VERIFICATION, false),
      autoCreateOrganization: await this.settings.getBoolean(SETTING_KEYS.REGISTRATION_AUTO_CREATE_ORG, true),
    };
  }

  async updateRegistrationSettings(
    dto: {
      enabled?: boolean;
      inviteOnly?: boolean;
      defaultPlan?: string;
      requireEmailVerification?: boolean;
      autoCreateOrganization?: boolean;
    },
    userId: string,
  ) {
    const entries: Array<[boolean | string | undefined, string]> = [
      [dto.enabled, SETTING_KEYS.REGISTRATION_ENABLED],
      [dto.inviteOnly, SETTING_KEYS.REGISTRATION_INVITE_ONLY],
      [dto.defaultPlan, SETTING_KEYS.REGISTRATION_DEFAULT_PLAN],
      [dto.requireEmailVerification, SETTING_KEYS.REGISTRATION_REQUIRE_EMAIL_VERIFICATION],
      [dto.autoCreateOrganization, SETTING_KEYS.REGISTRATION_AUTO_CREATE_ORG],
    ];
    for (const [val, key] of entries) {
      if (val !== undefined) {
        await this.settings.set(key, val, userId, { category: SystemSettingCategory.REGISTRATION });
      }
    }
    return this.getRegistrationSettings();
  }

  async getBillingSettings() {
    return {
      defaultCurrency: await this.settings.getString(SETTING_KEYS.BILLING_DEFAULT_CURRENCY, 'RUB'),
      invoicePrefix: await this.settings.getString(SETTING_KEYS.BILLING_INVOICE_PREFIX, 'INV'),
      paymentTimeoutHours: await this.settings.getNumber(SETTING_KEYS.BILLING_PAYMENT_TIMEOUT, 72),
      gracePeriodDays: await this.settings.getNumber(SETTING_KEYS.BILLING_GRACE_PERIOD, 3),
      trialDays: await this.settings.getNumber(SETTING_KEYS.BILLING_TRIAL_DAYS, 0),
    };
  }

  async updateBillingSettings(
    dto: {
      defaultCurrency?: string;
      invoicePrefix?: string;
      paymentTimeoutHours?: number;
      gracePeriodDays?: number;
      trialDays?: number;
    },
    userId: string,
  ) {
    const map: Array<[string | number | undefined, string]> = [
      [dto.defaultCurrency, SETTING_KEYS.BILLING_DEFAULT_CURRENCY],
      [dto.invoicePrefix, SETTING_KEYS.BILLING_INVOICE_PREFIX],
      [dto.paymentTimeoutHours, SETTING_KEYS.BILLING_PAYMENT_TIMEOUT],
      [dto.gracePeriodDays, SETTING_KEYS.BILLING_GRACE_PERIOD],
      [dto.trialDays, SETTING_KEYS.BILLING_TRIAL_DAYS],
    ];
    for (const [val, key] of map) {
      if (val !== undefined) {
        await this.settings.set(key, val, userId, { category: SystemSettingCategory.BILLING });
      }
    }
    return this.getBillingSettings();
  }

  async getIntegrationHealth() {
    const smtp = await this.getSmtpSettings();
    const yookassa = await this.listPaymentProviders();
    const yk = yookassa.find((p) => p.provider === PaymentProviderType.YOOKASSA);
    const creds = await this.getPaymentCredentials(PaymentProviderType.YOOKASSA);

    let yookassaStatus: 'Healthy' | 'Warning' | 'Error' = 'Error';
    if (creds.shopId && creds.secretKey && !creds.mockMode) yookassaStatus = 'Healthy';
    else if (creds.shopId || creds.mockMode) yookassaStatus = 'Warning';

    const smtpStatus: 'Healthy' | 'Warning' | 'Error' = smtp.configured
      ? 'Healthy'
      : smtp.host
        ? 'Warning'
        : 'Error';

    const [health, deps, queueMetrics] = await Promise.all([
      this.health.getSystemHealth(),
      this.dependencies.checkAll(),
      this.queues.getQueueMetrics(),
    ]);

    const pgOk = health?.checks?.database?.ok !== false;
    const redisOk = health?.queues?.redis !== false;
    const parserOk = health?.checks?.parser?.ok !== false;
    const s3Ok = health?.checks?.storage?.ok !== false;
    const queuesOk = !queueMetrics?.queues?.some((q: { failed: number }) => q.failed > 10);

    return {
      yookassa: yookassaStatus,
      smtp: smtpStatus,
      s3: s3Ok ? 'Healthy' : 'Error',
      redis: redisOk ? 'Healthy' : 'Error',
      parser: parserOk ? 'Healthy' : 'Warning',
      postgresql: pgOk ? 'Healthy' : 'Error',
      bullmq: queuesOk ? 'Healthy' : 'Warning',
      webhookReachable: yk?.isEnabled ? 'Healthy' : 'Warning',
    };
  }

  async getLaunchReadiness() {
    const smtp = await this.getSmtpSettings();
    const alerts = await this.getAlertSettings();
    const registration = await this.getRegistrationSettings();
    const yookassa = await this.getPaymentCredentials(PaymentProviderType.YOOKASSA);
    const paymentTest = await this.settings.getBoolean(SETTING_KEYS.LAUNCH_PAYMENT_TEST, false);
    const emailTest = await this.settings.getBoolean(SETTING_KEYS.LAUNCH_EMAIL_TEST, false);
    const publicUrl = await this.settings.getPublicUrl();

    const paymentConfigured = !!(yookassa.shopId && yookassa.secretKey);
    const provider = await this.prisma.paymentProvider.findUnique({
      where: { provider: PaymentProviderType.YOOKASSA },
    });

    const checks = {
      paymentConfigured,
      smtpConfigured: smtp.configured,
      alertEmailConfigured: !!alerts.alertEmail,
      webhookReachable: !!(provider?.isEnabled && paymentConfigured),
      paymentTestPassed: paymentTest,
      emailTestPassed: emailTest,
    };

    const informational = {
      registrationEnabled: registration.enabled,
      yookassaTestMode: await this.settings.isPaymentMockMode(),
      yookassaEnabled: provider?.isEnabled ?? false,
    };

    const weights = Object.keys(checks).length;
    const passed = Object.values(checks).filter(Boolean).length;
    const readinessPercent = Math.round((passed / weights) * 100);
    const allGreen = Object.values(checks).every(Boolean);

    return {
      checks,
      informational,
      readinessPercent,
      verdict: allGreen ? 'GO' : 'NO-GO',
      webhookUrl: `${publicUrl}/api/v1/payments/webhook/yookassa`,
      returnUrl: `${publicUrl}/billing/invoices?paid=1`,
    };
  }

  private async recordEmailError(message: string) {
    await this.settings.set(
      SETTING_KEYS.EMAIL_LAST_ERROR,
      { at: new Date().toISOString(), message },
      'system',
      { category: SystemSettingCategory.EMAIL },
    );
  }
}
