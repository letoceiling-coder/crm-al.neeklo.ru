-- M7_0: Memory profiles + plan limits + workflow memory steps

CREATE TYPE "MemoryProfileEntityType" AS ENUM ('USER', 'ASSISTANT', 'ORGANIZATION', 'CLIENT', 'WORKFLOW');
CREATE TYPE "MemoryProfileStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "MemoryEntryType" AS ENUM ('FACT', 'SUMMARY', 'NOTE', 'PREFERENCE', 'RULE', 'OBSERVATION');
CREATE TYPE "MemorySearchMode" AS ENUM ('KEYWORD', 'VECTOR', 'HYBRID');

ALTER TYPE "WorkflowStepType" ADD VALUE IF NOT EXISTS 'MEMORY_READ';
ALTER TYPE "WorkflowStepType" ADD VALUE IF NOT EXISTS 'MEMORY_WRITE';

ALTER TABLE "plan_limits"
  ADD COLUMN IF NOT EXISTS "max_memory_profiles" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS "max_memory_entries" INTEGER NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS "max_memory_storage_mb" INTEGER NOT NULL DEFAULT 100;

CREATE TABLE "memory_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entity_type" "MemoryProfileEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "status" "MemoryProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "memory_profiles_organization_id_entity_type_entity_id_key"
  ON "memory_profiles"("organization_id", "entity_type", "entity_id");
CREATE INDEX "memory_profiles_organization_id_entity_type_idx"
  ON "memory_profiles"("organization_id", "entity_type");

ALTER TABLE "memory_profiles" ADD CONSTRAINT "memory_profiles_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
