-- CreateTable
CREATE TABLE "ExpressSession" (
    "sid" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpressSession_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE INDEX "ExpressSession_expiresAt_idx" ON "ExpressSession"("expiresAt");
