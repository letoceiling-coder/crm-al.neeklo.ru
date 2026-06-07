-- M4_0: Tool providers

CREATE TYPE "ToolProviderType" AS ENUM ('INTERNAL', 'WEBHOOK', 'REST_API', 'GRAPHQL', 'MCP');

CREATE TABLE "tool_providers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider_type" "ToolProviderType" NOT NULL,
    "description" TEXT,
    "config_schema" JSONB NOT NULL DEFAULT '{}',
    "endpoint" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_providers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tool_providers_slug_key" ON "tool_providers"("slug");
