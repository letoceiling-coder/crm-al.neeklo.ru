-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('PERSONAL', 'COMPANY');
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'OPERATOR');

-- CreateTable organizations
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'PERSONAL',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateTable organization_members
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'OPERATOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");

-- CreateTable plan_limits
CREATE TABLE "plan_limits" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL DEFAULT 'free',
    "max_api_keys" INTEGER NOT NULL DEFAULT 3,
    "max_assistants" INTEGER NOT NULL DEFAULT 10,
    "max_agent_api_keys" INTEGER NOT NULL DEFAULT 20,
    "max_knowledge_bases" INTEGER NOT NULL DEFAULT 5,
    "max_documents" INTEGER NOT NULL DEFAULT 1000,
    "max_chunks" INTEGER NOT NULL DEFAULT 100000,
    "max_tool_instances" INTEGER NOT NULL DEFAULT 20,
    "max_storage_mb" INTEGER NOT NULL DEFAULT 5120,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_limits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plan_limits_organization_id_key" ON "plan_limits"("organization_id");

-- AlterTable users
ALTER TABLE "users" ADD COLUMN "active_organization_id" TEXT;

-- AlterTable api_keys (nullable first for backfill)
ALTER TABLE "api_keys" ADD COLUMN "organization_id" TEXT;

-- Foreign keys
ALTER TABLE "users" ADD CONSTRAINT "users_active_organization_id_fkey" FOREIGN KEY ("active_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_limits" ADD CONSTRAINT "plan_limits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: personal organization per user
DO $$
DECLARE
  u RECORD;
  org_id TEXT;
  org_slug TEXT;
  suffix INT;
BEGIN
  FOR u IN SELECT id, email, name FROM users LOOP
    org_slug := lower(regexp_replace(split_part(u.email, '@', 1), '[^a-zA-Z0-9]+', '-', 'g'));
    org_slug := trim(both '-' from org_slug);
    IF org_slug = '' OR org_slug IS NULL THEN
      org_slug := 'user';
    END IF;
    suffix := 0;
    WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug || CASE WHEN suffix = 0 THEN '' ELSE '-' || suffix::text END) LOOP
      suffix := suffix + 1;
    END LOOP;
    org_slug := org_slug || CASE WHEN suffix = 0 THEN '' ELSE '-' || suffix::text END;

    org_id := 'org_' || substr(md5(u.id || u.email), 1, 24);

    INSERT INTO organizations (id, type, name, slug, is_active, created_at, updated_at)
    VALUES (org_id, 'PERSONAL', COALESCE(u.name, u.email), org_slug, true, NOW(), NOW())
    ON CONFLICT (slug) DO NOTHING;

    IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = org_id) THEN
      SELECT id INTO org_id FROM organizations WHERE slug = org_slug LIMIT 1;
    END IF;

    INSERT INTO organization_members (id, organization_id, user_id, role, created_at)
    VALUES ('om_' || substr(md5(u.id || org_id), 1, 24), org_id, u.id, 'OWNER', NOW())
    ON CONFLICT DO NOTHING;

    INSERT INTO plan_limits (id, organization_id, plan_name, created_at, updated_at)
    VALUES ('pl_' || substr(md5(org_id), 1, 24), org_id, 'free', NOW(), NOW())
    ON CONFLICT DO NOTHING;

    UPDATE users SET active_organization_id = org_id WHERE id = u.id AND active_organization_id IS NULL;

    UPDATE api_keys SET organization_id = org_id WHERE user_id = u.id AND organization_id IS NULL;
  END LOOP;
END $$;

-- Enforce NOT NULL on api_keys.organization_id
ALTER TABLE "api_keys" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "api_keys_organization_id_idx" ON "api_keys"("organization_id");
