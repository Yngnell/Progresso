-- AlterTable
ALTER TABLE "News" ADD COLUMN     "emailedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "viewerEmailedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "receiveUpdates" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unsubscribeToken" TEXT,
ADD COLUMN     "updatesSince" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PendingSignup" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "receiveUpdates" BOOLEAN NOT NULL DEFAULT false,
    "codeHash" TEXT NOT NULL,
    "codeExpires" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingSignup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingSignup_email_key" ON "PendingSignup"("email");

-- CreateIndex
CREATE INDEX "PendingSignup_createdAt_idx" ON "PendingSignup"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_unsubscribeToken_key" ON "User"("unsubscribeToken");


-- Nothing that already exists is sent to residents: old alerts and news count as already emailed.
UPDATE "Notification" SET "viewerEmailedAt" = now();
UPDATE "News" SET "emailedAt" = now() WHERE "status" = 'PUBLISHED';
