-- M8_1: Integration accounts + assistant channel bindings

CREATE TABLE "integration_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "provider_enum" "IntegrationProviderType" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "IntegrationAccountStatus" NOT NULL DEFAULT 'PENDING',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "secret_id" TEXT,
    "webhook_secret" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_accounts_secret_id_key" ON "integration_accounts"("secret_id");
CREATE INDEX "integration_accounts_organization_id_idx" ON "integration_accounts"("organization_id");
CREATE INDEX "integration_accounts_organization_id_provider_idx" ON "integration_accounts"("organization_id", "provider_enum");
CREATE INDEX "integration_accounts_provider_id_idx" ON "integration_accounts"("provider_id");

ALTER TABLE "integration_accounts" ADD CONSTRAINT "integration_accounts_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_accounts" ADD CONSTRAINT "integration_accounts_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "integration_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_accounts" ADD CONSTRAINT "integration_accounts_secret_id_fkey"
  FOREIGN KEY ("secret_id") REFERENCES "encrypted_secrets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "assistant_integration_channels" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "assistant_id" TEXT NOT NULL,
    "integration_account_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_integration_channels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assistant_integration_channels_assistant_id_integration_account_id_key"
  ON "assistant_integration_channels"("assistant_id", "integration_account_id");
CREATE INDEX "assistant_integration_channels_organization_id_idx" ON "assistant_integration_channels"("organization_id");
CREATE INDEX "assistant_integration_channels_assistant_id_idx" ON "assistant_integration_channels"("assistant_id");

ALTER TABLE "assistant_integration_channels" ADD CONSTRAINT "assistant_integration_channels_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_integration_channels" ADD CONSTRAINT "assistant_integration_channels_assistant_id_fkey"
  FOREIGN KEY ("assistant_id") REFERENCES "key_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_integration_channels" ADD CONSTRAINT "assistant_integration_channels_integration_account_id_fkey"
  FOREIGN KEY ("integration_account_id") REFERENCES "integration_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
