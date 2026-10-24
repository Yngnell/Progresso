-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "councilApprovedOn" TIMESTAMP(3),
ADD COLUMN     "councilResolutionNo" TEXT;
