/*
  Warnings:

  - You are about to drop the column `original_name` on the `document_versions` table. All the data in the column will be lost.
  - You are about to drop the column `storage_path` on the `document_versions` table. All the data in the column will be lost.
  - You are about to drop the column `signed_file_path` on the `documents` table. All the data in the column will be lost.
  - Added the required column `url` to the `document_versions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."document_versions" DROP COLUMN "original_name",
DROP COLUMN "storage_path",
ADD COLUMN     "url" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."documents" DROP COLUMN "signed_file_path",
ADD COLUMN     "signed_file_url" TEXT;
