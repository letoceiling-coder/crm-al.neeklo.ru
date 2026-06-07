-- M7_3: Memory summaries

CREATE TABLE "memory_summaries" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "tokens_saved" INTEGER NOT NULL DEFAULT 0,
    "entry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_summaries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "memory_summaries_profile_id_created_at_idx" ON "memory_summaries"("profile_id", "created_at");

ALTER TABLE "memory_summaries" ADD CONSTRAINT "memory_summaries_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "memory_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
