-- CreateTable
CREATE TABLE "agent_api_keys" (
    "id" TEXT NOT NULL,
    "key_agent_id" TEXT NOT NULL,
    "api_key_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "environment" "AgentApiKeyEnvironment" NOT NULL DEFAULT 'PRODUCTION',
    "scopes" "AgentApiKeyScope"[] DEFAULT ARRAY['CHAT', 'TOOLS_INVOKE', 'KB_READ', 'MEMORY_READ', 'MEMORY_WRITE']::"AgentApiKeyScope"[],
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_encrypted" TEXT,
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "allowed_ips" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_api_keys_key_hash_key" ON "agent_api_keys"("key_hash");
CREATE INDEX "agent_api_keys_key_agent_id_idx" ON "agent_api_keys"("key_agent_id");
CREATE INDEX "agent_api_keys_api_key_id_idx" ON "agent_api_keys"("api_key_id");

ALTER TABLE "agent_api_keys" ADD CONSTRAINT "agent_api_keys_key_agent_id_fkey" FOREIGN KEY ("key_agent_id") REFERENCES "key_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_api_keys" ADD CONSTRAINT "agent_api_keys_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
