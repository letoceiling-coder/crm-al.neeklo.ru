-- M11_0 — Billing plan catalog
CREATE TYPE "BillingPlanTier" AS ENUM ('FREE', 'PRO', 'BUSINESS', 'ENTERPRISE');

CREATE TABLE "billing_plans" (
    "id" TEXT NOT NULL,
    "tier" "BillingPlanTier" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_monthly_rub" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "price_yearly_rub" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "max_api_keys" INTEGER NOT NULL DEFAULT 3,
    "max_assistants" INTEGER NOT NULL DEFAULT 10,
    "max_agent_api_keys" INTEGER NOT NULL DEFAULT 20,
    "max_knowledge_bases" INTEGER NOT NULL DEFAULT 5,
    "max_documents" INTEGER NOT NULL DEFAULT 1000,
    "max_chunks" INTEGER NOT NULL DEFAULT 100000,
    "max_tool_instances" INTEGER NOT NULL DEFAULT 20,
    "max_storage_mb" INTEGER NOT NULL DEFAULT 5120,
    "max_sources" INTEGER NOT NULL DEFAULT 50,
    "max_jobs" INTEGER NOT NULL DEFAULT 500,
    "max_memory_profiles" INTEGER NOT NULL DEFAULT 50,
    "max_memory_entries" INTEGER NOT NULL DEFAULT 10000,
    "max_memory_storage_mb" INTEGER NOT NULL DEFAULT 100,
    "rpm" INTEGER NOT NULL DEFAULT 120,
    "daily_requests" INTEGER NOT NULL DEFAULT 10000,
    "monthly_requests" INTEGER NOT NULL DEFAULT 300000,
    "monthly_tokens" BIGINT NOT NULL DEFAULT 10000000,
    "monthly_storage_mb" INTEGER NOT NULL DEFAULT 5120,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_plans_tier_key" ON "billing_plans"("tier");

INSERT INTO "billing_plans" ("id", "tier", "name", "description", "price_monthly_rub", "price_yearly_rub", "rpm", "daily_requests", "monthly_requests", "monthly_tokens", "monthly_storage_mb", "max_assistants", "max_knowledge_bases", "sort_order", "updated_at")
VALUES
  ('plan_free', 'FREE', 'Free', 'Для разработки и тестирования', 0, 0, 30, 500, 5000, 500000, 512, 3, 2, 0, NOW()),
  ('plan_pro', 'PRO', 'Pro', 'Для команд и SMB', 4990, 49900, 120, 10000, 300000, 10000000, 5120, 10, 5, 1, NOW()),
  ('plan_business', 'BUSINESS', 'Business', 'Для растущих компаний', 29990, 299900, 600, 100000, 3000000, 100000000, 51200, 50, 25, 2, NOW()),
  ('plan_enterprise', 'ENTERPRISE', 'Enterprise', 'Индивидуальные лимиты и SLA', 0, NULL, 3000, 1000000, 100000000, 1000000000, 512000, 500, 100, 3, NOW());
