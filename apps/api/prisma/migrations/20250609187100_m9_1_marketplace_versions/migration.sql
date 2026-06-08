-- M9_1: Marketplace package versions
CREATE TABLE IF NOT EXISTS "marketplace_versions" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "changelog" TEXT,
    "manifest" JSONB NOT NULL DEFAULT '{}',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketplace_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "marketplace_versions_package_id_version_key" ON "marketplace_versions"("package_id", "version");
CREATE INDEX IF NOT EXISTS "marketplace_versions_package_id_published_at_idx" ON "marketplace_versions"("package_id", "published_at");

ALTER TABLE "marketplace_versions" ADD CONSTRAINT "marketplace_versions_package_id_fkey"
    FOREIGN KEY ("package_id") REFERENCES "marketplace_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
