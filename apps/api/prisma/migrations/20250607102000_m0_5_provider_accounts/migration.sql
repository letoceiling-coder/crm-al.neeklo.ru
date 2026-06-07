-- CreateEnum
CREATE TYPE "AIProvider" AS ENUM ('OPENAI', 'OPENROUTER', 'ANTHROPIC', 'GEMINI', 'DEEPSEEK', 'MISTRAL', 'OLLAMA', 'CUSTOM');
CREATE TYPE "ProviderAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');

-- CreateTable encrypted_secrets
CREATE TABLE "encrypted_secrets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tool_instance_id" TEXT,
    "key" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "rotated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encrypted_secrets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "encrypted_secrets_organization_id_idx" ON "encrypted_secrets"("organization_id");

-- CreateTable provider_accounts
CREATE TABLE "provider_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "provider" "AIProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProviderAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "base_url" TEXT,
    "api_key_secret_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_accounts_api_key_secret_id_key" ON "provider_accounts"("api_key_secret_id");
CREATE INDEX "provider_accounts_organization_id_provider_idx" ON "provider_accounts"("organization_id", "provider");

-- Foreign keys
ALTER TABLE "encrypted_secrets" ADD CONSTRAINT "encrypted_secrets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_accounts" ADD CONSTRAINT "provider_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_accounts" ADD CONSTRAINT "provider_accounts_api_key_secret_id_fkey" FOREIGN KEY ("api_key_secret_id") REFERENCES "encrypted_secrets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
