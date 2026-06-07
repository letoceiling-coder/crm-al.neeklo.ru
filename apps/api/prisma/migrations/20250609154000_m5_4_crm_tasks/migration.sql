-- M5_4: CRM tasks

CREATE TABLE "crm_tasks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CrmTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "CrmTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "due_date" TIMESTAMP(3),
    "assigned_to_id" TEXT,
    "source_agent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_tasks_organization_id_idx" ON "crm_tasks"("organization_id");
CREATE INDEX "crm_tasks_workspace_id_idx" ON "crm_tasks"("workspace_id");
CREATE INDEX "crm_tasks_organization_id_status_idx" ON "crm_tasks"("organization_id", "status");

ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "crm_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_assigned_to_id_fkey"
  FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_source_agent_id_fkey"
  FOREIGN KEY ("source_agent_id") REFERENCES "key_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
