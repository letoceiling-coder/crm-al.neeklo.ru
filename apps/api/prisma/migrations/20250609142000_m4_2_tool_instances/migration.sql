-- M4_2: Tool instances (organization-scoped)

CREATE TYPE "ToolInstanceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');
CREATE TYPE "ToolExecutionStatus" AS ENUM ('SUCCESS', 'FAILED', 'TIMEOUT');

CREATE TABLE "tool_instances" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tool_definition_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ToolInstanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "secret_id" TEXT,
    "last_tested_at" TIMESTAMP(3),
    "last_test_status" "ToolExecutionStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_instances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tool_instances_secret_id_key" ON "tool_instances"("secret_id");
CREATE INDEX "tool_instances_organization_id_idx" ON "tool_instances"("organization_id");
CREATE INDEX "tool_instances_tool_definition_id_idx" ON "tool_instances"("tool_definition_id");
CREATE INDEX "tool_instances_organization_id_status_idx" ON "tool_instances"("organization_id", "status");

ALTER TABLE "tool_instances" ADD CONSTRAINT "tool_instances_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tool_instances" ADD CONSTRAINT "tool_instances_tool_definition_id_fkey"
  FOREIGN KEY ("tool_definition_id") REFERENCES "tool_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tool_instances" ADD CONSTRAINT "tool_instances_secret_id_fkey"
  FOREIGN KEY ("secret_id") REFERENCES "encrypted_secrets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "encrypted_secrets_tool_instance_id_idx" ON "encrypted_secrets"("tool_instance_id");
