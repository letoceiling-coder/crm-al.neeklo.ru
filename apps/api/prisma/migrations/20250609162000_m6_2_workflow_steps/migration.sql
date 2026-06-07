-- M6_2: Workflow steps

CREATE TABLE "workflow_steps" (
    "id" TEXT NOT NULL,
    "workflow_version_id" TEXT NOT NULL,
    "step_type" "WorkflowStepType" NOT NULL,
    "step_key" TEXT NOT NULL,
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workflow_steps_workflow_version_id_step_key_key"
  ON "workflow_steps"("workflow_version_id", "step_key");
CREATE INDEX "workflow_steps_workflow_version_id_position_idx"
  ON "workflow_steps"("workflow_version_id", "position");

ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_version_id_fkey"
  FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
