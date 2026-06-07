-- M6_3: Workflow executions

CREATE TABLE "workflow_executions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "workflow_version_id" TEXT NOT NULL,
    "status" "WorkflowExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "trigger_data" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workflow_executions_workflow_id_created_at_idx"
  ON "workflow_executions"("workflow_id", "created_at");
CREATE INDEX "workflow_executions_organization_id_created_at_idx"
  ON "workflow_executions"("organization_id", "created_at");
CREATE INDEX "workflow_executions_status_idx" ON "workflow_executions"("status");

ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_version_id_fkey"
  FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
