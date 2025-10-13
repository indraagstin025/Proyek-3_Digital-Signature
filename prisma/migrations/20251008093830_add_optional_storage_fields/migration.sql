/*
  Warnings:

  - You are about to drop the column `url` on the `document_versions` table. All the data in the column will be lost.
  - You are about to drop the column `signed_file_url` on the `documents` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."document_versions" DROP COLUMN "url",
ADD COLUMN     "original_name" TEXT,
ADD COLUMN     "storage_path" TEXT;

-- AlterTable
ALTER TABLE "public"."documents" DROP COLUMN "signed_file_url",
ADD COLUMN     "signed_file_path" TEXT;
