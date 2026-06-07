-- M4_4: Tool execution logs

CREATE TABLE "tool_execution_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "assistant_id" TEXT,
    "tool_instance_id" TEXT NOT NULL,
    "input" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB NOT NULL DEFAULT '{}',
    "status" "ToolExecutionStatus" NOT NULL,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_execution_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tool_execution_logs_tool_instance_id_created_at_idx"
  ON "tool_execution_logs"("tool_instance_id", "created_at");
CREATE INDEX "tool_execution_logs_assistant_id_created_at_idx"
  ON "tool_execution_logs"("assistant_id", "created_at");
CREATE INDEX "tool_execution_logs_organization_id_created_at_idx"
  ON "tool_execution_logs"("organization_id", "created_at");

ALTER TABLE "tool_execution_logs" ADD CONSTRAINT "tool_execution_logs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tool_execution_logs" ADD CONSTRAINT "tool_execution_logs_assistant_id_fkey"
  FOREIGN KEY ("assistant_id") REFERENCES "key_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tool_execution_logs" ADD CONSTRAINT "tool_execution_logs_tool_instance_id_fkey"
  FOREIGN KEY ("tool_instance_id") REFERENCES "tool_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
