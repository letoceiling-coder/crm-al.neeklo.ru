-- M11_3 — Usage aggregates
CREATE TYPE "UsageAggregatePeriod" AS ENUM ('DAY', 'MONTH');

CREATE TABLE "usage_aggregates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "period_type" "UsageAggregatePeriod" NOT NULL,
    "period_key" TEXT NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "token_count" BIGINT NOT NULL DEFAULT 0,
    "storage_mb" INTEGER NOT NULL DEFAULT 0,
    "cost_rub" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_aggregates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usage_aggregates_organization_id_period_type_period_key_key" ON "usage_aggregates"("organization_id", "period_type", "period_key");
CREATE INDEX "usage_aggregates_organization_id_period_type_idx" ON "usage_aggregates"("organization_id", "period_type");

ALTER TABLE "usage_aggregates" ADD CONSTRAINT "usage_aggregates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
