-- M5_2: CRM leads

CREATE TABLE "crm_leads" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "status" "CrmPipelineStage" NOT NULL DEFAULT 'NEW',
    "score" INTEGER NOT NULL DEFAULT 0,
    "assigned_to_id" TEXT,
    "source_agent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_leads_organization_id_idx" ON "crm_leads"("organization_id");
CREATE INDEX "crm_leads_workspace_id_idx" ON "crm_leads"("workspace_id");
CREATE INDEX "crm_leads_organization_id_status_idx" ON "crm_leads"("organization_id", "status");

ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "crm_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_assigned_to_id_fkey"
  FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_source_agent_id_fkey"
  FOREIGN KEY ("source_agent_id") REFERENCES "key_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
