/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Monitor` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `Monitor` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Monitor" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Monitor_slug_key" ON "Monitor"("slug");
