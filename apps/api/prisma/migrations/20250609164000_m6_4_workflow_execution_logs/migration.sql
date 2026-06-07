-- M6_4: Workflow execution logs

CREATE TABLE "workflow_execution_logs" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "step_id" TEXT,
    "status" "WorkflowStepExecutionStatus" NOT NULL,
    "input" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_execution_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workflow_execution_logs_execution_id_created_at_idx"
  ON "workflow_execution_logs"("execution_id", "created_at");

ALTER TABLE "workflow_execution_logs" ADD CONSTRAINT "workflow_execution_logs_execution_id_fkey"
  FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_execution_logs" ADD CONSTRAINT "workflow_execution_logs_step_id_fkey"
  FOREIGN KEY ("step_id") REFERENCES "workflow_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
