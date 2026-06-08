-- M11_4 — Marketplace monetization fields
CREATE TYPE "MarketplaceBillingType" AS ENUM ('FREE', 'PAID', 'SUBSCRIPTION');

ALTER TABLE "marketplace_packages" ADD COLUMN "price" DECIMAL(12,2);
ALTER TABLE "marketplace_packages" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'RUB';
ALTER TABLE "marketplace_packages" ADD COLUMN "billing_type" "MarketplaceBillingType" NOT NULL DEFAULT 'FREE';
