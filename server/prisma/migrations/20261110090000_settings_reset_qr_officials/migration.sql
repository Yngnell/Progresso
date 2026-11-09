-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'OFFICIAL';

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "method" TEXT NOT NULL DEFAULT 'QR';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "qrActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qrToken" TEXT,
ADD COLUMN     "qrValidFrom" TIMESTAMP(3),
ADD COLUMN     "qrValidUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "uploadedById" TEXT;

-- AlterTable
ALTER TABLE "ProjectTask" ADD COLUMN     "completedById" TEXT,
ADD COLUMN     "completedByName" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "previousLoginAt" TIMESTAMP(3),
ADD COLUMN     "resetTokenExpires" TIMESTAMP(3),
ADD COLUMN     "resetTokenHash" TEXT,
ADD COLUMN     "resetTokenSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL DEFAULT 'sk',
    "barangayName" TEXT NOT NULL DEFAULT 'Barangay Salinas 1, City of Bacoor, Cavite',
    "skTerm" TEXT NOT NULL DEFAULT '2023-2026',
    "logoFile" TEXT,
    "logoType" TEXT,
    "qrDefaultBeforeMin" INTEGER NOT NULL DEFAULT 30,
    "qrDefaultLengthMin" INTEGER,
    "lateAfterMin" INTEGER NOT NULL DEFAULT 15,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_eventId_userId_key" ON "AttendanceRecord"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_qrToken_key" ON "Event"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetTokenHash_key" ON "User"("resetTokenHash");

