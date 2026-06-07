-- M5_0: CRM workspace + enums

CREATE TYPE "CrmWorkspaceStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "CrmPipelineStage" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST');
CREATE TYPE "CrmClientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "CrmTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');
CREATE TYPE "CrmTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "CrmEntityType" AS ENUM ('CLIENT', 'LEAD', 'DEAL', 'TASK');
CREATE TYPE "CrmActivityAction" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'NOTE_ADDED', 'TOOL_EXECUTED', 'COMMENT');

CREATE TABLE "crm_workspaces" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'CRM',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "status" "CrmWorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_workspaces_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_workspaces_organization_id_key" ON "crm_workspaces"("organization_id");

ALTER TABLE "crm_workspaces" ADD CONSTRAINT "crm_workspaces_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
