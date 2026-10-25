-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "eventId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "notifyEmailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifyAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verifyCodeExpires" TIMESTAMP(3),
ADD COLUMN     "verifyCodeFor" TEXT,
ADD COLUMN     "verifyCodeHash" TEXT,
ADD COLUMN     "verifyCodeSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_eventId_type_key" ON "Notification"("eventId", "type");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Everyone who already exists keeps working: their login email and alert email count as verified.
UPDATE "User" SET "emailVerifiedAt" = now();
UPDATE "User" SET "notifyEmailVerifiedAt" = now() WHERE "notifyEmail" IS NOT NULL;
