-- M7_1: Memory entries

CREATE TABLE "memory_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "entry_type" "MemoryEntryType" NOT NULL,
    "importance" INTEGER NOT NULL DEFAULT 5,
    "source" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "char_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "memory_entries_profile_id_created_at_idx" ON "memory_entries"("profile_id", "created_at");
CREATE INDEX "memory_entries_organization_id_idx" ON "memory_entries"("organization_id");
CREATE INDEX "memory_entries_entry_type_idx" ON "memory_entries"("entry_type");

CREATE INDEX "memory_entries_content_fts_idx"
  ON "memory_entries" USING gin(to_tsvector('simple', "content"));

ALTER TABLE "memory_entries" ADD CONSTRAINT "memory_entries_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memory_entries" ADD CONSTRAINT "memory_entries_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "memory_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
