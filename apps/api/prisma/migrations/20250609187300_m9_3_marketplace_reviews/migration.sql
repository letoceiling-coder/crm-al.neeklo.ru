-- M9_3: Marketplace reviews
CREATE TABLE IF NOT EXISTS "marketplace_reviews" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketplace_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "marketplace_reviews_package_id_organization_id_key" ON "marketplace_reviews"("package_id", "organization_id");
CREATE INDEX IF NOT EXISTS "marketplace_reviews_package_id_rating_idx" ON "marketplace_reviews"("package_id", "rating");

ALTER TABLE "marketplace_reviews" ADD CONSTRAINT "marketplace_reviews_package_id_fkey"
    FOREIGN KEY ("package_id") REFERENCES "marketplace_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "marketplace_reviews" ADD CONSTRAINT "marketplace_reviews_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "marketplace_reviews" ADD CONSTRAINT "marketplace_reviews_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
