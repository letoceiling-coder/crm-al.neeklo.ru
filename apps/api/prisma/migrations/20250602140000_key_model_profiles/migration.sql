-- CreateEnum
CREATE TYPE "KeyRoutingMode" AS ENUM ('PROFILE', 'CUSTOM');

-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "routing_mode" "KeyRoutingMode" NOT NULL DEFAULT 'CUSTOM';
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "model_profile_id" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "key_model_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "price_per_million_rub" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "key_model_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "key_model_profile_chains" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,

    CONSTRAINT "key_model_profile_chains_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "key_model_profile_pricing" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "cost_price" DECIMAL(12,6) NOT NULL,
    "sell_price" DECIMAL(12,6) NOT NULL,
    "margin" DECIMAL(12,6) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '1M tokens',

    CONSTRAINT "key_model_profile_pricing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "key_model_profiles_user_id_slug_key" ON "key_model_profiles"("user_id", "slug");
CREATE INDEX IF NOT EXISTS "key_model_profiles_user_id_idx" ON "key_model_profiles"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "key_model_profile_chains_profile_id_priority_key" ON "key_model_profile_chains"("profile_id", "priority");
CREATE UNIQUE INDEX IF NOT EXISTS "key_model_profile_pricing_profile_id_model_id_key" ON "key_model_profile_pricing"("profile_id", "model_id");
CREATE INDEX IF NOT EXISTS "api_keys_model_profile_id_idx" ON "api_keys"("model_profile_id");

ALTER TABLE "api_keys" DROP CONSTRAINT IF EXISTS "api_keys_model_profile_id_fkey";
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_model_profile_id_fkey" FOREIGN KEY ("model_profile_id") REFERENCES "key_model_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "key_model_profiles" DROP CONSTRAINT IF EXISTS "key_model_profiles_user_id_fkey";
ALTER TABLE "key_model_profiles" ADD CONSTRAINT "key_model_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "key_model_profile_chains" DROP CONSTRAINT IF EXISTS "key_model_profile_chains_profile_id_fkey";
ALTER TABLE "key_model_profile_chains" ADD CONSTRAINT "key_model_profile_chains_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "key_model_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "key_model_profile_chains" DROP CONSTRAINT IF EXISTS "key_model_profile_chains_model_id_fkey";
ALTER TABLE "key_model_profile_chains" ADD CONSTRAINT "key_model_profile_chains_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "key_model_profile_pricing" DROP CONSTRAINT IF EXISTS "key_model_profile_pricing_profile_id_fkey";
ALTER TABLE "key_model_profile_pricing" ADD CONSTRAINT "key_model_profile_pricing_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "key_model_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "key_model_profile_pricing" DROP CONSTRAINT IF EXISTS "key_model_profile_pricing_model_id_fkey";
ALTER TABLE "key_model_profile_pricing" ADD CONSTRAINT "key_model_profile_pricing_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
