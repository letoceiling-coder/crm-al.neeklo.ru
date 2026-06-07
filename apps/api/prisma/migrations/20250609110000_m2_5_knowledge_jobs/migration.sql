-- M2_5: Knowledge Jobs + PlanLimits extensions
CREATE TYPE "KnowledgeJobType" AS ENUM (
  'INGEST_URL',
  'EXPAND_SITEMAP',
  'EXPAND_DOMAIN',
  'DOCUMENT_PROCESS',
  'ZIP_EXTRACT',
  'REPROCESS'
);

CREATE TYPE "KnowledgeJobStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'SKIPPED',
  'CANCELLED'
);

CREATE TABLE "knowledge_jobs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "knowledge_base_id" TEXT NOT NULL,
    "knowledge_source_id" TEXT,
    "knowledge_document_id" TEXT,
    "parent_job_id" TEXT,
    "type" "KnowledgeJobType" NOT NULL,
    "status" "KnowledgeJobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "queue_name" TEXT,
    "bull_job_id" TEXT,
    "error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_jobs_organization_id_status_idx" ON "knowledge_jobs"("organization_id", "status");
CREATE INDEX "knowledge_jobs_knowledge_base_id_created_at_idx" ON "knowledge_jobs"("knowledge_base_id", "created_at");
CREATE INDEX "knowledge_jobs_knowledge_source_id_idx" ON "knowledge_jobs"("knowledge_source_id");
CREATE INDEX "knowledge_jobs_status_created_at_idx" ON "knowledge_jobs"("status", "created_at");

ALTER TABLE "knowledge_jobs" ADD CONSTRAINT "knowledge_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_jobs" ADD CONSTRAINT "knowledge_jobs_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_jobs" ADD CONSTRAINT "knowledge_jobs_knowledge_source_id_fkey" FOREIGN KEY ("knowledge_source_id") REFERENCES "knowledge_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "knowledge_jobs" ADD CONSTRAINT "knowledge_jobs_knowledge_document_id_fkey" FOREIGN KEY ("knowledge_document_id") REFERENCES "knowledge_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "knowledge_jobs" ADD CONSTRAINT "knowledge_jobs_parent_job_id_fkey" FOREIGN KEY ("parent_job_id") REFERENCES "knowledge_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "plan_limits" ADD COLUMN IF NOT EXISTS "max_sources" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "plan_limits" ADD COLUMN IF NOT EXISTS "max_jobs" INTEGER NOT NULL DEFAULT 500;
ALTER TABLE "plan_limits" ADD COLUMN IF NOT EXISTS "max_urls_per_sitemap" INTEGER NOT NULL DEFAULT 500;
