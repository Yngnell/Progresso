-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CHAIRMAN';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "approvalState" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reviewRemarks" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: projects that already moved past PROPOSED are treated as approved.
UPDATE "Project" SET "approvalState" = 'APPROVED' WHERE "status" <> 'PROPOSED';
