-- M8_5_0: Workflow hardening — WAITING status, checkpoint, timezone
ALTER TYPE "WorkflowExecutionStatus" ADD VALUE IF NOT EXISTS 'WAITING';

ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "schedule_timezone" TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "source_template_id" TEXT;

ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "checkpoint" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "resume_at" TIMESTAMP(3);
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "source_template_id" TEXT;

CREATE INDEX IF NOT EXISTS "workflow_executions_resume_at_idx" ON "workflow_executions"("resume_at");
CREATE INDEX IF NOT EXISTS "workflow_executions_organization_id_status_idx" ON "workflow_executions"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "workflows_source_template_id_idx" ON "workflows"("source_template_id");
