-- M8_4: Integration events

CREATE TABLE "integration_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" "IntegrationProviderType" NOT NULL,
    "account_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "IntegrationEventStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "integration_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "integration_events_organization_id_created_at_idx"
  ON "integration_events"("organization_id", "created_at");
CREATE INDEX "integration_events_account_id_event_type_idx"
  ON "integration_events"("account_id", "event_type");
CREATE INDEX "integration_events_status_idx" ON "integration_events"("status");

ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "integration_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
