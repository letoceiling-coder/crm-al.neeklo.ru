-- CreateTable
CREATE TABLE "agent_variables" (
    "id" TEXT NOT NULL,
    "key_agent_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_variables_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_variables_key_agent_id_key_key" ON "agent_variables"("key_agent_id", "key");
CREATE INDEX "agent_variables_key_agent_id_idx" ON "agent_variables"("key_agent_id");

ALTER TABLE "agent_variables" ADD CONSTRAINT "agent_variables_key_agent_id_fkey" FOREIGN KEY ("key_agent_id") REFERENCES "key_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
