-- pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable embedding_profiles
CREATE TABLE "embedding_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "provider_account_id" TEXT,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL DEFAULT 3072,
    "provider" TEXT NOT NULL DEFAULT 'openrouter',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "embedding_profiles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "embedding_profiles_organization_id_idx" ON "embedding_profiles"("organization_id");

ALTER TABLE "embedding_profiles" ADD CONSTRAINT "embedding_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "embedding_profiles" ADD CONSTRAINT "embedding_profiles_provider_account_id_fkey" FOREIGN KEY ("provider_account_id") REFERENCES "provider_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- KnowledgeEmbedding foundation (chunk FK deferred to Stage 4)
CREATE TABLE "knowledge_embeddings" (
    "id" TEXT NOT NULL,
    "chunk_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "embedding" vector(3072),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_embeddings_chunk_id_key" ON "knowledge_embeddings"("chunk_id");
CREATE INDEX "knowledge_embeddings_profile_id_idx" ON "knowledge_embeddings"("profile_id");

ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "embedding_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- HNSW index deferred to Stage 5 (pgvector HNSW max 2000 dimensions; default embedding is 3072)
