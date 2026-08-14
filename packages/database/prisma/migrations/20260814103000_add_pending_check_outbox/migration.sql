-- CreateTable
CREATE TABLE "PendingCheck" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingCheck_pkey" PRIMARY KEY ("id")
);
