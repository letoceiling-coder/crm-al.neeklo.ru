-- M2_7: KnowledgeChunk + embedding pipeline foundation

CREATE TYPE "KnowledgeEmbeddingStatus" AS ENUM (
  'PENDING',
  'CHUNKING',
  'EMBEDDING',
  'INDEXED',
  'FAILED'
);

CREATE TYPE "ChunkStrategy" AS ENUM (
  'FIXED',
  'PARAGRAPH',
  'SECTION',
  'LEGAL_ARTICLE',
  'MARKDOWN'
);

ALTER TYPE "KnowledgeJobType" ADD VALUE IF NOT EXISTS 'CHUNK';
ALTER TYPE "KnowledgeJobType" ADD VALUE IF NOT EXISTS 'EMBED';
ALTER TYPE "KnowledgeJobType" ADD VALUE IF NOT EXISTS 'REEMBED';

ALTER TABLE "embedding_profiles" ADD COLUMN IF NOT EXISTS "metric" TEXT NOT NULL DEFAULT 'cosine';

ALTER TABLE "knowledge_documents"
  ADD COLUMN IF NOT EXISTS "chunk_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "embedding_status" "KnowledgeEmbeddingStatus" NOT NULL DEFAULT 'PENDING';

CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "knowledge_base_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "char_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_chunks_document_id_version_id_chunk_index_key"
  ON "knowledge_chunks"("document_id", "version_id", "chunk_index");
CREATE INDEX "knowledge_chunks_knowledge_base_id_idx" ON "knowledge_chunks"("knowledge_base_id");
CREATE INDEX "knowledge_chunks_organization_id_idx" ON "knowledge_chunks"("organization_id");
CREATE INDEX "knowledge_chunks_document_id_idx" ON "knowledge_chunks"("document_id");

CREATE INDEX "knowledge_chunks_content_fts_idx"
  ON "knowledge_chunks" USING gin(to_tsvector('simple', "content"));

ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_knowledge_base_id_fkey"
  FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_version_id_fkey"
  FOREIGN KEY ("version_id") REFERENCES "knowledge_document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Re-link embeddings to chunks (foundation table was empty at Stage 0)
DELETE FROM "knowledge_embeddings";

DROP INDEX IF EXISTS "knowledge_embeddings_chunk_id_key";

CREATE UNIQUE INDEX "knowledge_embeddings_chunk_id_profile_id_key"
  ON "knowledge_embeddings"("chunk_id", "profile_id");

ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_chunk_id_fkey"
  FOREIGN KEY ("chunk_id") REFERENCES "knowledge_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- pgvector: HNSW max 2000 dimensions; default profile uses 3072 → sequential scan until Qdrant migration
-- IVFFlat available for profiles with dimensions <= 2000 (create per-profile via admin job in Stage 3+)
COMMENT ON TABLE "knowledge_embeddings" IS 'vector(3072) bucket; index with IVFFlat for dims<=2000 or migrate to Qdrant at 50M+ vectors';
