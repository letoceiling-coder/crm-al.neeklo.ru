-- M9_0: Marketplace packages foundation
CREATE TYPE "MarketplacePackageType" AS ENUM (
    'ASSISTANT',
    'WORKFLOW',
    'TOOL',
    'KNOWLEDGE_TEMPLATE',
    'AUTOMATION_PACKAGE'
);

CREATE TYPE "MarketplacePackageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TYPE "MarketplaceVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'ORG_ONLY');

CREATE TABLE IF NOT EXISTS "marketplace_packages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "category_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" "MarketplacePackageType" NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "status" "MarketplacePackageStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "MarketplaceVisibility" NOT NULL DEFAULT 'PUBLIC',
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "installs" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "banner" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "marketplace_packages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "marketplace_packages_slug_key" ON "marketplace_packages"("slug");
CREATE INDEX IF NOT EXISTS "marketplace_packages_organization_id_status_idx" ON "marketplace_packages"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "marketplace_packages_type_status_visibility_idx" ON "marketplace_packages"("type", "status", "visibility");
CREATE INDEX IF NOT EXISTS "marketplace_packages_is_featured_status_idx" ON "marketplace_packages"("is_featured", "status");

ALTER TABLE "marketplace_packages" ADD CONSTRAINT "marketplace_packages_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "marketplace_packages" ADD CONSTRAINT "marketplace_packages_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
