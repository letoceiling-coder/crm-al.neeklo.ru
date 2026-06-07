-- M6_0: Workflows

CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "WorkflowTriggerType" AS ENUM ('MANUAL', 'SCHEDULE', 'CRM_EVENT', 'KB_EVENT', 'TOOL_EVENT', 'WEBHOOK');
CREATE TYPE "WorkflowStepType" AS ENUM ('START', 'CONDITION', 'ASSISTANT', 'TOOL', 'CRM', 'WEBHOOK', 'WAIT', 'BRANCH', 'END');
CREATE TYPE "WorkflowExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'DLQ');
CREATE TYPE "WorkflowStepExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "trigger_type" "WorkflowTriggerType" NOT NULL,
    "trigger_config" JSONB NOT NULL DEFAULT '{}',
    "schedule_cron" TEXT,
    "webhook_token" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "current_version_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workflows_webhook_token_key" ON "workflows"("webhook_token");
CREATE UNIQUE INDEX "workflows_current_version_id_key" ON "workflows"("current_version_id");
CREATE INDEX "workflows_organization_id_idx" ON "workflows"("organization_id");
CREATE INDEX "workflows_organization_id_is_active_idx" ON "workflows"("organization_id", "is_active");
CREATE INDEX "workflows_trigger_type_idx" ON "workflows"("trigger_type");

ALTER TABLE "workflows" ADD CONSTRAINT "workflows_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
