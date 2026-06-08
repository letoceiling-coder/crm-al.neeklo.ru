-- M9_2: Marketplace install log (clone-only, no cross-tenant entity refs)
CREATE TYPE "MarketplaceInstallStatus" AS ENUM ('ACTIVE', 'UNINSTALLED', 'FAILED');

CREATE TABLE IF NOT EXISTS "marketplace_installs" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "installed_organization_id" TEXT NOT NULL,
    "installed_by_id" TEXT NOT NULL,
    "status" "MarketplaceInstallStatus" NOT NULL DEFAULT 'ACTIVE',
    "cloned_entities" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalled_at" TIMESTAMP(3),
    CONSTRAINT "marketplace_installs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "marketplace_installs_installed_organization_id_status_idx" ON "marketplace_installs"("installed_organization_id", "status");
CREATE INDEX IF NOT EXISTS "marketplace_installs_package_id_status_idx" ON "marketplace_installs"("package_id", "status");

ALTER TABLE "marketplace_installs" ADD CONSTRAINT "marketplace_installs_package_id_fkey"
    FOREIGN KEY ("package_id") REFERENCES "marketplace_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "marketplace_installs" ADD CONSTRAINT "marketplace_installs_version_id_fkey"
    FOREIGN KEY ("version_id") REFERENCES "marketplace_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "marketplace_installs" ADD CONSTRAINT "marketplace_installs_installed_organization_id_fkey"
    FOREIGN KEY ("installed_organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "marketplace_installs" ADD CONSTRAINT "marketplace_installs_installed_by_id_fkey"
    FOREIGN KEY ("installed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
