-- M2_0: Knowledge Bases
CREATE TYPE "KnowledgeBaseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

CREATE TABLE "knowledge_bases" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "KnowledgeBaseStatus" NOT NULL DEFAULT 'DRAFT',
    "embedding_profile_id" TEXT,
    "stats" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_bases_organization_id_slug_key" ON "knowledge_bases"("organization_id", "slug");
CREATE INDEX "knowledge_bases_organization_id_status_idx" ON "knowledge_bases"("organization_id", "status");

ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_embedding_profile_id_fkey" FOREIGN KEY ("embedding_profile_id") REFERENCES "embedding_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
