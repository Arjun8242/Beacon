-- AlterTable
ALTER TABLE "Check" ADD COLUMN "failureReason" TEXT;

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN "failureReason" TEXT;
