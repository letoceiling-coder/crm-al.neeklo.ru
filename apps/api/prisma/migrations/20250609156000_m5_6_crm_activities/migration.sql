-- M5_6: CRM activities

CREATE TABLE "crm_activities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "entity_type" "CrmEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "CrmActivityAction" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_activities_organization_id_idx" ON "crm_activities"("organization_id");
CREATE INDEX "crm_activities_entity_type_entity_id_created_at_idx"
  ON "crm_activities"("entity_type", "entity_id", "created_at");

ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "crm_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
