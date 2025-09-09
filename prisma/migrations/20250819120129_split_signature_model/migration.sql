/*
  Warnings:

  - You are about to drop the `signatures` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."signatures" DROP CONSTRAINT "signatures_document_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."signatures" DROP CONSTRAINT "signatures_user_id_fkey";

-- DropTable
DROP TABLE "public"."signatures";

-- CreateTable
CREATE TABLE "public"."signatures_personal" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "method" "public"."signing_method" NOT NULL,
    "signatureUrl" TEXT,
    "qrCodeData" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "profileImage" TEXT,

    CONSTRAINT "signatures_personal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."signatures_group" (
    "id" SERIAL NOT NULL,
    "signature_image_path" TEXT NOT NULL,
    "signing_method" "public"."signing_method" NOT NULL,
    "verification_hash" TEXT,
    "signed_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" UUID NOT NULL,
    "document_id" INTEGER NOT NULL,

    CONSTRAINT "signatures_group_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."signatures_personal" ADD CONSTRAINT "signatures_personal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."signatures_personal" ADD CONSTRAINT "signatures_personal_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."signatures_group" ADD CONSTRAINT "signatures_group_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."signatures_group" ADD CONSTRAINT "signatures_group_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
