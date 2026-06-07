ALTER TABLE "usage_logs" ADD COLUMN IF NOT EXISTS "profile_slug" TEXT;

CREATE INDEX IF NOT EXISTS "usage_logs_profile_slug_idx" ON "usage_logs"("profile_slug");
