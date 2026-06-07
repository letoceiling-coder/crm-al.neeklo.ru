-- CreateTable token_cost_snapshots
CREATE TABLE "token_cost_snapshots" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_price" DECIMAL(20,10) NOT NULL,
    "output_price" DECIMAL(20,10) NOT NULL,
    "cached_input_price" DECIMAL(20,10),
    "cached_output_price" DECIMAL(20,10),
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_cost_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "token_cost_snapshots_provider_model_effective_from_key" ON "token_cost_snapshots"("provider", "model", "effective_from");
CREATE INDEX "token_cost_snapshots_provider_model_effective_from_idx" ON "token_cost_snapshots"("provider", "model", "effective_from");

-- AlterTable usage_logs
ALTER TABLE "usage_logs" ADD COLUMN "token_cost_snapshot_id" TEXT;
ALTER TABLE "usage_logs" ADD COLUMN "cost_usd" DECIMAL(12,6);

ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_token_cost_snapshot_id_fkey" FOREIGN KEY ("token_cost_snapshot_id") REFERENCES "token_cost_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "usage_logs_token_cost_snapshot_id_idx" ON "usage_logs"("token_cost_snapshot_id");
