-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('LAWYER', 'MARKETING', 'DEVELOPER', 'SALES', 'SUPPORT', 'HR', 'REAL_ESTATE', 'EDUCATION', 'ASSISTANT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AgentApiKeyEnvironment" AS ENUM ('PRODUCTION', 'TEST', 'CRM', 'TELEGRAM', 'WEBHOOK', 'INTERNAL');

-- CreateEnum
CREATE TYPE "AgentApiKeyScope" AS ENUM ('CHAT', 'TOOLS_INVOKE', 'KB_READ', 'MEMORY_READ', 'MEMORY_WRITE', 'CRM_READ', 'CRM_WRITE', 'ADMIN');

-- CreateTable
CREATE TABLE "agent_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "agent_type" "AgentType" NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "is_marketplace" BOOLEAN NOT NULL DEFAULT false,
    "author_organization_id" TEXT,
    "default_prompt" TEXT NOT NULL,
    "default_settings" JSONB NOT NULL DEFAULT '{}',
    "install_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_templates_slug_key" ON "agent_templates"("slug");
CREATE INDEX "agent_templates_agent_type_idx" ON "agent_templates"("agent_type");
CREATE INDEX "agent_templates_is_public_is_marketplace_idx" ON "agent_templates"("is_public", "is_marketplace");

ALTER TABLE "agent_templates" ADD CONSTRAINT "agent_templates_author_organization_id_fkey" FOREIGN KEY ("author_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
