-- M2_2: Knowledge Documents
CREATE TYPE "KnowledgeDocumentFormat" AS ENUM ('PDF', 'DOCX', 'TXT', 'MD', 'HTML', 'URL', 'ZIP', 'MANUAL');
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'SKIPPED_QUALITY', 'FAILED');

CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "knowledge_base_id" TEXT NOT NULL,
    "knowledge_source_id" TEXT,
    "category_id" TEXT,
    "topic_id" TEXT,
    "title" TEXT,
    "format" "KnowledgeDocumentFormat" NOT NULL,
    "source_url" TEXT,
    "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "current_version" INTEGER NOT NULL DEFAULT 0,
    "raw_s3_key" TEXT,
    "processed_s3_key" TEXT,
    "parser_job_id" TEXT,
    "ok_content" BOOLEAN,
    "content_validation" JSONB,
    "parser_chars" INTEGER,
    "parser_warnings" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_documents_knowledge_base_id_status_idx" ON "knowledge_documents"("knowledge_base_id", "status");
CREATE INDEX "knowledge_documents_organization_id_idx" ON "knowledge_documents"("organization_id");
CREATE INDEX "knowledge_documents_knowledge_source_id_idx" ON "knowledge_documents"("knowledge_source_id");

ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_knowledge_source_id_fkey" FOREIGN KEY ("knowledge_source_id") REFERENCES "knowledge_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
