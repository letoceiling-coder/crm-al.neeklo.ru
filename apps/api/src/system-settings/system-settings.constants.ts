export const PLATFORM_ORG_ID = 'org_platform_system';

export const SETTING_KEYS = {
  APP_PUBLIC_URL: 'app.public_url',
  PAYMENT_MOCK_MODE: 'payment.mock_mode',
  REGISTRATION_ENABLED: 'registration.enabled',
  REGISTRATION_INVITE_ONLY: 'registration.invite_only',
  REGISTRATION_DEFAULT_PLAN: 'registration.default_plan',
  REGISTRATION_REQUIRE_EMAIL_VERIFICATION: 'registration.require_email_verification',
  REGISTRATION_AUTO_CREATE_ORG: 'registration.auto_create_organization',
  BILLING_DEFAULT_CURRENCY: 'billing.default_currency',
  BILLING_INVOICE_PREFIX: 'billing.invoice_prefix',
  BILLING_PAYMENT_TIMEOUT: 'billing.payment_timeout_hours',
  BILLING_GRACE_PERIOD: 'billing.grace_period_days',
  BILLING_TRIAL_DAYS: 'billing.trial_days',
  ALERTS_EMAIL: 'alerts.email',
  ALERTS_QUEUE: 'alerts.queue_enabled',
  ALERTS_PAYMENT: 'alerts.payment_enabled',
  ALERTS_STORAGE: 'alerts.storage_enabled',
  ALERTS_SMTP: 'alerts.smtp_enabled',
  ALERTS_SECURITY: 'alerts.security_enabled',
  ALERTS_PARSER: 'alerts.parser_enabled',
  ALERTS_TELEGRAM: 'alerts.telegram_enabled',
  TELEGRAM_BOT_CONFIG: 'telegram.bot_config',
  TELEGRAM_CONFIG: 'alerts.telegram_config',
  SMTP_CONFIG: 'smtp.config',
  PARSER_CONFIG: 'parser.config',
  EMAIL_LAST_SUCCESS: 'email.last_success_at',
  EMAIL_LAST_ERROR: 'email.last_error',
  LAUNCH_PAYMENT_TEST: 'launch.payment_test_passed',
  LAUNCH_EMAIL_TEST: 'launch.email_test_passed',
} as const;

export type SmtpConfigValue = {
  host: string;
  port: number;
  tls: boolean;
  user: string;
  from: string;
  passwordSecretId: string | null;
};

export type ParserConfigValue = {
  baseUrl: string;
  apiKeySecretId: string | null;
};

export type TelegramBotConfigValue = {
  botTokenSecretId: string | null;
  webhookRegisteredAt: string | null;
  webhookOk: boolean;
  lastWebhookError: string | null;
};

export type PaymentProviderConfigValue = {
  displayName?: string;
  testMode?: boolean;
  shopId?: string;
  secretKeySecretId?: string | null;
  webhookPath?: string;
  returnPath?: string;
};

export const ENV_FALLBACKS: Record<string, string> = {
  [SETTING_KEYS.APP_PUBLIC_URL]: 'APP_PUBLIC_URL',
  [SETTING_KEYS.PAYMENT_MOCK_MODE]: 'PAYMENT_MOCK_MODE',
  [SETTING_KEYS.REGISTRATION_ENABLED]: 'REGISTRATION_ENABLED',
  [SETTING_KEYS.ALERTS_EMAIL]: 'ALERT_EMAIL',
};

export const SECRET_KEYS = {
  smtpPassword: 'system:smtp:password',
  parserApiKey: 'system:parser:api_key',
  telegramBotToken: 'system:telegram:bot_token',
  paymentSecret: (provider: string) => `system:payment:${provider}:secret_key`,
} as const;
