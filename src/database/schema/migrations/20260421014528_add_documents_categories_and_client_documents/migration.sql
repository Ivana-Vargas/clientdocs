-- CreateEnum
CREATE TYPE "DocumentStorageProvider" AS ENUM ('LOCAL', 'S3');

-- CreateTable
CREATE TABLE "document_categories" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_documents" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "storage_provider" "DocumentStorageProvider" NOT NULL DEFAULT 'LOCAL',
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "uploaded_by_user_id" UUID,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_categories_public_id_key" ON "document_categories"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_categories_slug_key" ON "document_categories"("slug");

-- CreateIndex
CREATE INDEX "idx_document_categories_is_active" ON "document_categories"("is_active");

-- CreateIndex
CREATE INDEX "idx_document_categories_created_by_user_id" ON "document_categories"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_documents_public_id_key" ON "client_documents"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_documents_storage_key_key" ON "client_documents"("storage_key");

-- CreateIndex
CREATE INDEX "idx_client_documents_client_id" ON "client_documents"("client_id");

-- CreateIndex
CREATE INDEX "idx_client_documents_category_id" ON "client_documents"("category_id");

-- CreateIndex
CREATE INDEX "idx_client_documents_is_current" ON "client_documents"("is_current");

-- CreateIndex
CREATE INDEX "idx_client_documents_uploaded_by_user_id" ON "client_documents"("uploaded_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_client_documents_client_category_version" ON "client_documents"("client_id", "category_id", "version");

-- AddForeignKey
ALTER TABLE "document_categories" ADD CONSTRAINT "document_categories_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "document_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
