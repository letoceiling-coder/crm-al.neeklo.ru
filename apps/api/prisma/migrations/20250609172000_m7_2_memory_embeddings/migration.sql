-- M7_2: Memory embeddings (pgvector)

CREATE TABLE "memory_embeddings" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "embedding" vector(3072),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "memory_embeddings_entry_id_key" ON "memory_embeddings"("entry_id");
CREATE INDEX "memory_embeddings_profile_id_idx" ON "memory_embeddings"("profile_id");

ALTER TABLE "memory_embeddings" ADD CONSTRAINT "memory_embeddings_entry_id_fkey"
  FOREIGN KEY ("entry_id") REFERENCES "memory_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memory_embeddings" ADD CONSTRAINT "memory_embeddings_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "embedding_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMENT ON TABLE "memory_embeddings" IS 'Long-term memory vectors; uses org EmbeddingProfile';
