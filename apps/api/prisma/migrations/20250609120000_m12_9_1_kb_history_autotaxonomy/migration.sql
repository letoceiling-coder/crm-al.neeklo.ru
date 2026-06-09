-- Stage 12.9.1: Knowledge History Events table
-- Provides a dedicated audit trail for KB/document lifecycle events.
-- Replaces the stub History tab with real data.

CREATE TYPE "KnowledgeHistoryEventType" AS ENUM (
  'KB_CREATED',
  'KB_UPDATED',
  'DOCUMENT_CREATED',
  'DOCUMENT_UPDATED',
  'DOCUMENT_DELETED',
  'INGEST_COMPLETED',
  'INGEST_FAILED',
  'INGEST_SKIPPED',
  'ENRICHMENT_STARTED',
  'ENRICHMENT_COMPLETED',
  'ENRICHMENT_FAILED',
  'CHUNKING_COMPLETED',
  'EMBEDDING_COMPLETED',
  'DOCUMENT_REPROCESSED',
  'ERROR'
);

CREATE TABLE "knowledge_history_events" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "knowledge_base_id" TEXT NOT NULL,
  "document_id"      TEXT,
  "event_type"       "KnowledgeHistoryEventType" NOT NULL,
  "actor_id"         TEXT,
  "actor_email"      TEXT,
  "data"             JSONB NOT NULL DEFAULT '{}',
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "knowledge_history_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "knowledge_history_events"
  ADD CONSTRAINT "knowledge_history_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_history_events"
  ADD CONSTRAINT "knowledge_history_events_knowledge_base_id_fkey"
  FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_history_events"
  ADD CONSTRAINT "knowledge_history_events_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "knowledge_history_events_kb_created_idx"
  ON "knowledge_history_events"("knowledge_base_id", "created_at" DESC);

CREATE INDEX "knowledge_history_events_org_idx"
  ON "knowledge_history_events"("organization_id");

CREATE INDEX "knowledge_history_events_doc_idx"
  ON "knowledge_history_events"("document_id");
