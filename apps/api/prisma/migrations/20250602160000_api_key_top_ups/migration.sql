CREATE TYPE "ApiKeyTopUpType" AS ENUM ('INITIAL', 'TOP_UP');

CREATE TABLE "api_key_top_ups" (
    "id" TEXT NOT NULL,
    "api_key_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount_rub" DECIMAL(14,2) NOT NULL,
    "balance_before" DECIMAL(14,2) NOT NULL,
    "balance_after" DECIMAL(14,2) NOT NULL,
    "type" "ApiKeyTopUpType" NOT NULL DEFAULT 'TOP_UP',
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_key_top_ups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "api_key_top_ups_api_key_id_created_at_idx" ON "api_key_top_ups"("api_key_id", "created_at");
CREATE INDEX "api_key_top_ups_user_id_created_at_idx" ON "api_key_top_ups"("user_id", "created_at");

ALTER TABLE "api_key_top_ups" ADD CONSTRAINT "api_key_top_ups_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "api_key_top_ups" ADD CONSTRAINT "api_key_top_ups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
