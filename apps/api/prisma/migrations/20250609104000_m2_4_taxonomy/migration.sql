-- M2_4: Knowledge Taxonomy (Category, Topic, Tag)
CREATE TABLE "knowledge_categories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "knowledge_base_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_categories_knowledge_base_id_slug_key" ON "knowledge_categories"("knowledge_base_id", "slug");
CREATE INDEX "knowledge_categories_organization_id_idx" ON "knowledge_categories"("organization_id");
CREATE INDEX "knowledge_categories_parent_id_idx" ON "knowledge_categories"("parent_id");

ALTER TABLE "knowledge_categories" ADD CONSTRAINT "knowledge_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_categories" ADD CONSTRAINT "knowledge_categories_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_categories" ADD CONSTRAINT "knowledge_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "knowledge_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "knowledge_topics" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "knowledge_base_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_topics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_topics_knowledge_base_id_slug_key" ON "knowledge_topics"("knowledge_base_id", "slug");
CREATE INDEX "knowledge_topics_category_id_idx" ON "knowledge_topics"("category_id");

ALTER TABLE "knowledge_topics" ADD CONSTRAINT "knowledge_topics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_topics" ADD CONSTRAINT "knowledge_topics_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_topics" ADD CONSTRAINT "knowledge_topics_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "knowledge_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "knowledge_tags" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "knowledge_base_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_tags_knowledge_base_id_slug_key" ON "knowledge_tags"("knowledge_base_id", "slug");

ALTER TABLE "knowledge_tags" ADD CONSTRAINT "knowledge_tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_tags" ADD CONSTRAINT "knowledge_tags_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "knowledge_document_tags" (
    "document_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "knowledge_document_tags_pkey" PRIMARY KEY ("document_id","tag_id")
);

ALTER TABLE "knowledge_document_tags" ADD CONSTRAINT "knowledge_document_tags_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_document_tags" ADD CONSTRAINT "knowledge_document_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "knowledge_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Document FK to taxonomy (deferred from M2_2)
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "knowledge_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "knowledge_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
