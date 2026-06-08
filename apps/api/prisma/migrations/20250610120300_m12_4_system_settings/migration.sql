-- M12_4: system_settings
CREATE TYPE "SystemSettingType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');
CREATE TYPE "SystemSettingCategory" AS ENUM (
  'GENERAL', 'PAYMENT', 'EMAIL', 'ALERT', 'REGISTRATION', 'BILLING', 'SECURITY', 'STORAGE', 'MONITORING', 'LAUNCH'
);

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SYSTEM_SETTING_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_PROVIDER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SMTP_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ALERT_UPDATED';

CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "type" "SystemSettingType" NOT NULL DEFAULT 'JSON',
    "category" "SystemSettingCategory" NOT NULL DEFAULT 'GENERAL',
    "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");
CREATE INDEX "system_settings_category_idx" ON "system_settings"("category");

ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "system_settings" ("id", "key", "value", "type", "category", "is_encrypted", "updated_at")
VALUES
  ('cm12ss000000000000000general1', 'app.public_url', '"https://crm-al.neeklo.ru"', 'STRING', 'GENERAL', false, NOW()),
  ('cm12ss000000000000000paymock1', 'payment.mock_mode', 'true', 'BOOLEAN', 'PAYMENT', false, NOW()),
  ('cm12ss000000000000regenabled', 'registration.enabled', 'false', 'BOOLEAN', 'REGISTRATION', false, NOW()),
  ('cm12ss000000000000reginvite', 'registration.invite_only', 'false', 'BOOLEAN', 'REGISTRATION', false, NOW()),
  ('cm12ss000000000000regdplan', 'registration.default_plan', '"FREE"', 'STRING', 'REGISTRATION', false, NOW()),
  ('cm12ss000000000000regverify', 'registration.require_email_verification', 'false', 'BOOLEAN', 'REGISTRATION', false, NOW()),
  ('cm12ss000000000000regautorg', 'registration.auto_create_organization', 'true', 'BOOLEAN', 'REGISTRATION', false, NOW()),
  ('cm12ss000000000000billcurr', 'billing.default_currency', '"RUB"', 'STRING', 'BILLING', false, NOW()),
  ('cm12ss000000000000billpref', 'billing.invoice_prefix', '"INV"', 'STRING', 'BILLING', false, NOW()),
  ('cm12ss000000000000billtimeout', 'billing.payment_timeout_hours', '72', 'NUMBER', 'BILLING', false, NOW()),
  ('cm12ss000000000000billgrace', 'billing.grace_period_days', '3', 'NUMBER', 'BILLING', false, NOW()),
  ('cm12ss000000000000billtrial', 'billing.trial_days', '0', 'NUMBER', 'BILLING', false, NOW()),
  ('cm12ss000000000000alertsemail', 'alerts.email', '""', 'STRING', 'ALERT', false, NOW()),
  ('cm12ss000000000000alertqueue', 'alerts.queue_enabled', 'true', 'BOOLEAN', 'ALERT', false, NOW()),
  ('cm12ss000000000000alertpay', 'alerts.payment_enabled', 'true', 'BOOLEAN', 'ALERT', false, NOW()),
  ('cm12ss000000000000alertstor', 'alerts.storage_enabled', 'true', 'BOOLEAN', 'ALERT', false, NOW()),
  ('cm12ss000000000000alertsmtp', 'alerts.smtp_enabled', 'true', 'BOOLEAN', 'ALERT', false, NOW()),
  ('cm12ss000000000000alertsec', 'alerts.security_enabled', 'true', 'BOOLEAN', 'ALERT', false, NOW()),
  ('cm12ss000000000000launchpay', 'launch.payment_test_passed', 'false', 'BOOLEAN', 'LAUNCH', false, NOW()),
  ('cm12ss000000000000launchemail', 'launch.email_test_passed', 'false', 'BOOLEAN', 'LAUNCH', false, NOW()),
  ('cm12ss000000000000emailok', 'email.last_success_at', 'null', 'JSON', 'EMAIL', false, NOW()),
  ('cm12ss000000000000emailerr', 'email.last_error', 'null', 'JSON', 'EMAIL', false, NOW())
ON CONFLICT ("key") DO NOTHING;
