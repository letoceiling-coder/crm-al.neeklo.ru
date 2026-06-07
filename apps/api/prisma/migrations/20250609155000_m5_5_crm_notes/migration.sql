-- M5_5: CRM notes

CREATE TABLE "crm_notes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "entity_type" "CrmEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_notes_organization_id_idx" ON "crm_notes"("organization_id");
CREATE INDEX "crm_notes_entity_type_entity_id_idx" ON "crm_notes"("entity_type", "entity_id");

ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "crm_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
