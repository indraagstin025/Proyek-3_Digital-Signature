/*
  Warnings:

  - Made the column `originalFilePath` on table `documents` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."documents" ALTER COLUMN "originalFilePath" SET NOT NULL;
