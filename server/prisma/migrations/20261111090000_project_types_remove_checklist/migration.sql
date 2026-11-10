-- DropForeignKey
ALTER TABLE "ProjectTask" DROP CONSTRAINT "ProjectTask_projectId_fkey";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "audience" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "progressType" TEXT NOT NULL DEFAULT 'DATETIME',
ADD COLUMN     "targetAttendees" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "actsAsOfficialId" TEXT;

-- DropTable
DROP TABLE "ProjectTask";

