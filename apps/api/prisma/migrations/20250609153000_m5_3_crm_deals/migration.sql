-- M5_3: CRM deals

CREATE TABLE "crm_deals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "status" "CrmPipelineStage" NOT NULL DEFAULT 'NEW',
    "client_id" TEXT,
    "lead_id" TEXT,
    "source_agent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_deals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_deals_organization_id_idx" ON "crm_deals"("organization_id");
CREATE INDEX "crm_deals_workspace_id_idx" ON "crm_deals"("workspace_id");
CREATE INDEX "crm_deals_organization_id_status_idx" ON "crm_deals"("organization_id", "status");

ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "crm_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "crm_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_source_agent_id_fkey"
  FOREIGN KEY ("source_agent_id") REFERENCES "key_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
