-- CreateEnum
CREATE TYPE "public"."document_status" AS ENUM ('draft', 'pending', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "public"."group_member_role" AS ENUM ('admin_group', 'signer', 'viewer');

-- CreateEnum
CREATE TYPE "public"."signing_method" AS ENUM ('canvas', 'qrcode');

-- CreateEnum
CREATE TYPE "public"."InvitationStatus" AS ENUM ('active', 'used', 'expired');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "phone_number" TEXT,
    "title" TEXT,
    "company" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documents" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "original_hash" TEXT,
    "status" "public"."document_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" UUID NOT NULL,
    "group_id" INTEGER,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."signatures" (
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

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "group_invitations_token_key" ON "public"."group_invitations"("token");

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."signatures" ADD CONSTRAINT "signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."signatures" ADD CONSTRAINT "signatures_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."groups" ADD CONSTRAINT "groups_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_invitations" ADD CONSTRAINT "group_invitations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
