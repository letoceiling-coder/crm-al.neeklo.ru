-- M9_5: Marketplace assets (S3-backed)
CREATE TYPE "MarketplaceAssetType" AS ENUM ('ICON', 'BANNER', 'SCREENSHOT', 'FILE');

CREATE TABLE IF NOT EXISTS "marketplace_assets" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "type" "MarketplaceAssetType" NOT NULL,
    "s3_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketplace_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "marketplace_assets_package_id_type_idx" ON "marketplace_assets"("package_id", "type");

ALTER TABLE "marketplace_assets" ADD CONSTRAINT "marketplace_assets_package_id_fkey"
    FOREIGN KEY ("package_id") REFERENCES "marketplace_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
