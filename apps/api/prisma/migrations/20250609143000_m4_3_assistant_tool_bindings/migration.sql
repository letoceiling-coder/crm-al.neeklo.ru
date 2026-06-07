-- M4_3: Assistant tool bindings

CREATE TABLE "assistant_tool_bindings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "assistant_id" TEXT NOT NULL,
    "tool_instance_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "allowed_actions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_tool_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assistant_tool_bindings_assistant_id_tool_instance_id_key"
  ON "assistant_tool_bindings"("assistant_id", "tool_instance_id");
CREATE INDEX "assistant_tool_bindings_assistant_id_enabled_priority_idx"
  ON "assistant_tool_bindings"("assistant_id", "enabled", "priority");
CREATE INDEX "assistant_tool_bindings_organization_id_idx"
  ON "assistant_tool_bindings"("organization_id");

ALTER TABLE "assistant_tool_bindings" ADD CONSTRAINT "assistant_tool_bindings_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_tool_bindings" ADD CONSTRAINT "assistant_tool_bindings_assistant_id_fkey"
  FOREIGN KEY ("assistant_id") REFERENCES "key_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_tool_bindings" ADD CONSTRAINT "assistant_tool_bindings_tool_instance_id_fkey"
  FOREIGN KEY ("tool_instance_id") REFERENCES "tool_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
