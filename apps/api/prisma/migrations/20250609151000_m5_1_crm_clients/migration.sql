-- M5_1: CRM clients

CREATE TABLE "crm_clients" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "CrmClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_clients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_clients_organization_id_idx" ON "crm_clients"("organization_id");
CREATE INDEX "crm_clients_workspace_id_idx" ON "crm_clients"("workspace_id");
CREATE INDEX "crm_clients_organization_id_status_idx" ON "crm_clients"("organization_id", "status");

ALTER TABLE "crm_clients" ADD CONSTRAINT "crm_clients_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_clients" ADD CONSTRAINT "crm_clients_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "crm_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_clients" ADD CONSTRAINT "crm_clients_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
