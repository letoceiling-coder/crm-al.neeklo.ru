-- M3_0: Assistant ↔ Knowledge Base bindings

CREATE TYPE "AssistantSearchMode" AS ENUM ('KEYWORD', 'VECTOR', 'HYBRID');

CREATE TABLE "assistant_knowledge_bindings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "assistant_id" TEXT NOT NULL,
    "knowledge_base_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "max_chunks" INTEGER NOT NULL DEFAULT 5,
    "max_tokens" INTEGER NOT NULL DEFAULT 2000,
    "search_mode" "AssistantSearchMode" NOT NULL DEFAULT 'HYBRID',
    "keyword_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "vector_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_knowledge_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assistant_knowledge_bindings_assistant_id_knowledge_base_id_key"
  ON "assistant_knowledge_bindings"("assistant_id", "knowledge_base_id");
CREATE INDEX "assistant_knowledge_bindings_assistant_id_enabled_priority_idx"
  ON "assistant_knowledge_bindings"("assistant_id", "enabled", "priority");
CREATE INDEX "assistant_knowledge_bindings_organization_id_idx"
  ON "assistant_knowledge_bindings"("organization_id");

ALTER TABLE "assistant_knowledge_bindings" ADD CONSTRAINT "assistant_knowledge_bindings_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_knowledge_bindings" ADD CONSTRAINT "assistant_knowledge_bindings_assistant_id_fkey"
  FOREIGN KEY ("assistant_id") REFERENCES "key_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_knowledge_bindings" ADD CONSTRAINT "assistant_knowledge_bindings_knowledge_base_id_fkey"
  FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
