-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "proposedByName" TEXT,
ADD COLUMN     "proposedByPosition" TEXT;

-- Data fix: end dates entered before times were supported sit at 00:00 UTC
-- (8:00 AM Philippine time). Move them to 5:00 PM Philippine time (09:00 UTC) so a
-- project ending "today" is not overdue for the whole day. Start dates already
-- sit at 8:00 AM Philippine time.
UPDATE "Project"
SET "endDate" = "endDate" + interval '9 hours'
WHERE "endDate" IS NOT NULL
  AND "endDate"::time = '00:00:00';
