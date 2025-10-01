-- CreateEnum
CREATE TYPE "public"."document_status" AS ENUM ('draft', 'pending', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "public"."group_member_role" AS ENUM ('admin_group', 'signer', 'viewer');

-- CreateEnum
CREATE TYPE "public"."signing_method" AS ENUM ('canvas', 'qrcode');

-- CreateEnum
CREATE TYPE "public"."InvitationStatus" AS ENUM ('active', 'used', 'expired');

-- CreateEnum
CREATE TYPE "public"."SignatureStatus" AS ENUM ('PENDING', 'SIGNED', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "phone_number" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "company" TEXT,
    "address" TEXT,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "profile_picture_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_profile_pictures" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profile_pictures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documents" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "public"."document_status" NOT NULL DEFAULT 'draft',
    "signed_file_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" UUID NOT NULL,
    "group_id" INTEGER,
    "current_version_id" UUID,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_versions" (
    "id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "document_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."signatures_personal" (
    "id" UUID NOT NULL,
    "method" "public"."signing_method" NOT NULL,
    "signature_image_url" TEXT NOT NULL,
    "qr_code_data_url" TEXT,
    "position_x" DOUBLE PRECISION NOT NULL,
    "position_y" DOUBLE PRECISION NOT NULL,
    "page_number" INTEGER NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "document_version_id" UUID NOT NULL,
    "signer_id" UUID NOT NULL,

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
    "document_version_id" UUID NOT NULL,

    CONSTRAINT "signatures_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."groups" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "admin_id" UUID NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."group_members" (
    "id" SERIAL NOT NULL,
    "role" "public"."group_member_role" NOT NULL DEFAULT 'viewer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "group_id" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."group_invitations" (
    "id" SERIAL NOT NULL,
    "email" TEXT,
    "token" TEXT NOT NULL,
    "role" "public"."group_member_role" NOT NULL,
    "status" "public"."InvitationStatus" NOT NULL DEFAULT 'active',
    "usage_limit" INTEGER,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "group_id" INTEGER NOT NULL,

    CONSTRAINT "group_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_pictures_user_id_hash_key" ON "public"."user_profile_pictures"("user_id", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "documents_current_version_id_key" ON "public"."documents"("current_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_user_id_hash_key" ON "public"."document_versions"("user_id", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "group_invitations_token_key" ON "public"."group_invitations"("token");

-- AddForeignKey
ALTER TABLE "public"."user_profile_pictures" ADD CONSTRAINT "user_profile_pictures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "public"."document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."signatures_personal" ADD CONSTRAINT "signatures_personal_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."signatures_personal" ADD CONSTRAINT "signatures_personal_signer_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."signatures_group" ADD CONSTRAINT "signatures_group_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."signatures_group" ADD CONSTRAINT "signatures_group_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."groups" ADD CONSTRAINT "groups_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_invitations" ADD CONSTRAINT "group_invitations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
