-- M2_3: Knowledge Document Versions
CREATE TABLE "knowledge_document_versions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "change_note" TEXT,
    "s3_key" TEXT NOT NULL,
    "char_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_document_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_document_versions_document_id_version_key" ON "knowledge_document_versions"("document_id", "version");

ALTER TABLE "knowledge_document_versions" ADD CONSTRAINT "knowledge_document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
