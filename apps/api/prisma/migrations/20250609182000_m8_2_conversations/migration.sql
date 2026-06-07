-- M8_2: Conversations (unified inbox)

CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "channel" "ConversationChannel" NOT NULL,
    "external_id" TEXT NOT NULL,
    "assistant_id" TEXT,
    "integration_account_id" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "last_message_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversations_organization_id_channel_external_id_key"
  ON "conversations"("organization_id", "channel", "external_id");
CREATE INDEX "conversations_organization_id_last_message_at_idx"
  ON "conversations"("organization_id", "last_message_at");
CREATE INDEX "conversations_assistant_id_idx" ON "conversations"("assistant_id");

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assistant_id_fkey"
  FOREIGN KEY ("assistant_id") REFERENCES "key_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_integration_account_id_fkey"
  FOREIGN KEY ("integration_account_id") REFERENCES "integration_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
