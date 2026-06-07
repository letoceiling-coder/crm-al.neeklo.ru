-- CreateTable
CREATE TABLE "key_agents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "template_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "agent_type" "AgentType" NOT NULL DEFAULT 'ASSISTANT',
    "status" "AgentStatus" NOT NULL DEFAULT 'DRAFT',
    "system_prompt" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "key_agents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "key_agents_organization_id_slug_key" ON "key_agents"("organization_id", "slug");
CREATE INDEX "key_agents_organization_id_agent_type_idx" ON "key_agents"("organization_id", "agent_type");
CREATE INDEX "key_agents_organization_id_status_idx" ON "key_agents"("organization_id", "status");

ALTER TABLE "key_agents" ADD CONSTRAINT "key_agents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "key_agents" ADD CONSTRAINT "key_agents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "agent_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "key_agents" ADD CONSTRAINT "key_agents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "key_agents" ADD CONSTRAINT "key_agents_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
