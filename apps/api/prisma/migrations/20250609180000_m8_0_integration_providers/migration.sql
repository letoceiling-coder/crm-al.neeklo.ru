-- M8_0: Integration providers catalog + INTEGRATION_EVENT workflow trigger

CREATE TYPE "IntegrationProviderType" AS ENUM (
  'TELEGRAM', 'MAX', 'EMAIL', 'WEBHOOK', 'BITRIX24', 'AMOCRM', 'GOOGLE', 'CUSTOM'
);
CREATE TYPE "IntegrationAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR', 'PENDING');
CREATE TYPE "ConversationChannel" AS ENUM ('TELEGRAM', 'MAX', 'EMAIL', 'WEBHOOK');
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED');
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'SYSTEM');
CREATE TYPE "IntegrationEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

ALTER TYPE "WorkflowTriggerType" ADD VALUE IF NOT EXISTS 'INTEGRATION_EVENT';

CREATE TABLE "integration_providers" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProviderType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "settings_schema" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_providers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_providers_provider_key" ON "integration_providers"("provider");

INSERT INTO "integration_providers" ("id", "provider", "name", "description", "updated_at") VALUES
  ('int-prov-telegram', 'TELEGRAM', 'Telegram Bot', 'Telegram Bot API webhook/polling', NOW()),
  ('int-prov-max', 'MAX', 'MAX Messenger', 'MAX bot messages and attachments', NOW()),
  ('int-prov-email', 'EMAIL', 'Email', 'SMTP send / IMAP receive', NOW()),
  ('int-prov-webhook', 'WEBHOOK', 'Webhook', 'Inbound/outbound HTTP webhooks', NOW()),
  ('int-prov-bitrix24', 'BITRIX24', 'Bitrix24', 'OAuth + CRM webhooks', NOW()),
  ('int-prov-amocrm', 'AMOCRM', 'amoCRM', 'OAuth + CRM webhooks', NOW()),
  ('int-prov-google', 'GOOGLE', 'Google Workspace', 'Calendar, Drive, Docs (provider layer)', NOW()),
  ('int-prov-custom', 'CUSTOM', 'Custom', 'Custom integration adapter', NOW());
