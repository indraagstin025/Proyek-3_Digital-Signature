/*
  Warnings:

  - The primary key for the `signatures_group` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `created_at` on the `signatures_group` table. All the data in the column will be lost.
  - You are about to drop the column `signature_image_path` on the `signatures_group` table. All the data in the column will be lost.
  - You are about to drop the column `signing_method` on the `signatures_group` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `signatures_group` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `signatures_group` table. All the data in the column will be lost.
  - You are about to drop the column `verification_hash` on the `signatures_group` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[signed_file_hash]` on the table `document_versions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `inviter_id` to the `group_invitations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `method` to the `signatures_group` table without a default value. This is not possible if the table is not empty.
  - Added the required column `page_number` to the `signatures_group` table without a default value. This is not possible if the table is not empty.
  - Added the required column `position_x` to the `signatures_group` table without a default value. This is not possible if the table is not empty.
  - Added the required column `position_y` to the `signatures_group` table without a default value. This is not possible if the table is not empty.
  - Added the required column `signature_image_url` to the `signatures_group` table without a default value. This is not possible if the table is not empty.
  - Added the required column `signer_id` to the `signatures_group` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `signatures_group` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "public"."signatures_group" DROP CONSTRAINT "signatures_group_user_id_fkey";

-- AlterTable
ALTER TABLE "public"."document_versions" ADD COLUMN     "signed_file_hash" TEXT;

-- AlterTable
ALTER TABLE "public"."group_invitations" ADD COLUMN     "inviter_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "public"."signatures_group" DROP CONSTRAINT "signatures_group_pkey",
DROP COLUMN "created_at",
DROP COLUMN "signature_image_path",
DROP COLUMN "signing_method",
DROP COLUMN "updated_at",
DROP COLUMN "user_id",
DROP COLUMN "verification_hash",
ADD COLUMN     "height" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "method" "public"."signing_method" NOT NULL,
ADD COLUMN     "page_number" INTEGER NOT NULL,
ADD COLUMN     "position_x" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "position_y" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "signature_image_url" TEXT NOT NULL,
ADD COLUMN     "signer_id" UUID NOT NULL,
ADD COLUMN     "user_agent" TEXT,
ADD COLUMN     "width" DOUBLE PRECISION NOT NULL DEFAULT 0,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "signed_at" SET DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "signatures_group_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."signatures_personal" ADD COLUMN     "display_qr_code" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "user_agent" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_signed_file_hash_key" ON "public"."document_versions"("signed_file_hash");

-- AddForeignKey
ALTER TABLE "public"."signatures_group" ADD CONSTRAINT "signatures_group_signer_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_invitations" ADD CONSTRAINT "group_invitations_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
