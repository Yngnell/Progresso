-- Official photos (optional) for the SK Officials cards. Additive only.

-- AlterTable
ALTER TABLE "Official" ADD COLUMN     "photoFile" TEXT,
ADD COLUMN     "photoType" TEXT;

