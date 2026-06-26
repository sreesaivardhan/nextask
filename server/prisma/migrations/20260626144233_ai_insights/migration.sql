/*
  Warnings:

  - You are about to drop the column `payload` on the `AIInsight` table. All the data in the column will be lost.
  - Added the required column `summary` to the `AIInsight` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `AIInsight` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `AIInsight` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AIInsight" DROP COLUMN "payload",
ADD COLUMN     "data" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "summary" TEXT NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
