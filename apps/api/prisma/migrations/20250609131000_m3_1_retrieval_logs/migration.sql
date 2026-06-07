-- M3_1: Retrieval audit logs

CREATE TABLE "retrieval_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "assistant_id" TEXT NOT NULL,
    "knowledge_base_id" TEXT,
    "query" TEXT NOT NULL,
    "search_mode" "AssistantSearchMode" NOT NULL,
    "chunks_found" INTEGER NOT NULL DEFAULT 0,
    "chunks_used" INTEGER NOT NULL DEFAULT 0,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retrieval_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "retrieval_logs_assistant_id_created_at_idx"
  ON "retrieval_logs"("assistant_id", "created_at");
CREATE INDEX "retrieval_logs_organization_id_created_at_idx"
  ON "retrieval_logs"("organization_id", "created_at");

ALTER TABLE "retrieval_logs" ADD CONSTRAINT "retrieval_logs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retrieval_logs" ADD CONSTRAINT "retrieval_logs_assistant_id_fkey"
  FOREIGN KEY ("assistant_id") REFERENCES "key_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
