/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ComplexityStatus" AS ENUM ('PENDING', 'ACCEPTED', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE', 'GITHUB');

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "complexityStatus" "ComplexityStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "spConfidence" INTEGER,
ADD COLUMN     "spReasons" JSONB,
ADD COLUMN     "suggestedSp" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authProvider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "email" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "resetTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resetTokenHash" TEXT;

-- CreateTable
CREATE TABLE "WeeklyDigest" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "cardsCreated" INTEGER NOT NULL,
    "cardsCompleted" INTEGER NOT NULL,
    "currentVelocity" DOUBLE PRECISION NOT NULL,
    "velocityTrend" TEXT NOT NULL,
    "currentWIP" INTEGER NOT NULL,
    "topBottleneck" JSONB,
    "riskSummary" JSONB,
    "recommendations" JSONB,
    "rawMetrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyDigest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyDigest_boardId_idx" ON "WeeklyDigest"("boardId");

-- CreateIndex
CREATE INDEX "WeeklyDigest_generatedAt_idx" ON "WeeklyDigest"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "WeeklyDigest" ADD CONSTRAINT "WeeklyDigest_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
