-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('TOPUP', 'CALL_CHARGE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WalletTransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "costKobo" INTEGER;

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "balanceKobo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ratePerMinuteKobo" INTEGER NOT NULL DEFAULT 15000;

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "status" "WalletTransactionStatus" NOT NULL DEFAULT 'SUCCESS',
    "amountKobo" INTEGER NOT NULL,
    "balanceAfterKobo" INTEGER,
    "reference" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "callId" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_reference_key" ON "WalletTransaction"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_callId_key" ON "WalletTransaction"("callId");

-- CreateIndex
CREATE INDEX "WalletTransaction_organisationId_createdAt_idx" ON "WalletTransaction"("organisationId", "createdAt");

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
