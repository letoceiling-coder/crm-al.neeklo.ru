-- M2_1: Knowledge Sources (Source Registry)
CREATE TYPE "KnowledgeSourceType" AS ENUM ('URL', 'SITEMAP', 'DOMAIN', 'RSS', 'FILE', 'API');
CREATE TYPE "CrawlStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'FAILED', 'BLOCKED');
CREATE TYPE "ParserMode" AS ENUM ('STANDARD', 'AGGRESSIVE', 'HEADLESS_ONLY', 'MARKETPLACE_HARD', 'DOCUMENT_FIRST', 'LEGAL_FAST', 'LEGAL_DEEP');

CREATE TABLE "knowledge_sources" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "knowledge_base_id" TEXT NOT NULL,
    "type" "KnowledgeSourceType" NOT NULL,
    "name" TEXT,
    "url" TEXT,
    "domain" TEXT,
    "sitemap_url" TEXT,
    "parser_mode" "ParserMode",
    "crawl_status" "CrawlStatus" NOT NULL DEFAULT 'PENDING',
    "last_parsed_at" TIMESTAMP(3),
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "success_rate" DOUBLE PRECISION,
    "quality_score" DOUBLE PRECISION,
    "last_error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_sources_knowledge_base_id_crawl_status_idx" ON "knowledge_sources"("knowledge_base_id", "crawl_status");
CREATE INDEX "knowledge_sources_organization_id_idx" ON "knowledge_sources"("organization_id");
CREATE INDEX "knowledge_sources_domain_idx" ON "knowledge_sources"("domain");

ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
