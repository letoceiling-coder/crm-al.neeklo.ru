-- M7_4: Memory search logs

CREATE TABLE "memory_search_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "profile_id" TEXT,
    "assistant_id" TEXT,
    "query" TEXT NOT NULL,
    "mode" "MemorySearchMode" NOT NULL DEFAULT 'HYBRID',
    "results" JSONB NOT NULL DEFAULT '[]',
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "debug" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_search_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "memory_search_logs_organization_id_created_at_idx"
  ON "memory_search_logs"("organization_id", "created_at");
CREATE INDEX "memory_search_logs_profile_id_idx" ON "memory_search_logs"("profile_id");

ALTER TABLE "memory_search_logs" ADD CONSTRAINT "memory_search_logs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memory_search_logs" ADD CONSTRAINT "memory_search_logs_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "memory_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
