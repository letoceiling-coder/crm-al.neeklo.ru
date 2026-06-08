-- M12_0: payment_providers
CREATE TYPE "PaymentProviderType" AS ENUM ('YOOKASSA', 'STRIPE', 'ROBOKASSA', 'CLOUDPAYMENTS');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED');

CREATE TABLE "payment_providers" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProviderType" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_providers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_providers_provider_key" ON "payment_providers"("provider");

INSERT INTO "payment_providers" ("id", "provider", "is_enabled", "is_default", "config", "updated_at")
VALUES
  ('cm12pp000000000000000yookassa', 'YOOKASSA', false, true, '{}', NOW()),
  ('cm12pp000000000000000stripe00', 'STRIPE', false, false, '{}', NOW()),
  ('cm12pp000000000000robokassa0', 'ROBOKASSA', false, false, '{}', NOW()),
  ('cm12pp000000000000cloudpay00', 'CLOUDPAYMENTS', false, false, '{}', NOW());
