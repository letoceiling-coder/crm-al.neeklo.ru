-- M4_1: Tool definitions (system catalog)

CREATE TABLE "tool_definitions" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "provider_type" "ToolProviderType" NOT NULL,
    "input_schema" JSONB NOT NULL DEFAULT '{}',
    "output_schema" JSONB NOT NULL DEFAULT '{}',
    "settings_schema" JSONB NOT NULL DEFAULT '{}',
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tool_definitions_slug_key" ON "tool_definitions"("slug");
CREATE INDEX "tool_definitions_provider_id_idx" ON "tool_definitions"("provider_id");
CREATE INDEX "tool_definitions_provider_type_idx" ON "tool_definitions"("provider_type");

ALTER TABLE "tool_definitions" ADD CONSTRAINT "tool_definitions_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "tool_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
