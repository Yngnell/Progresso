-- Attendance has only two statuses now: Present (scanned the QR) and Absent (did not scan
-- by the time the event ended). Late becomes Present and Excused becomes Absent. The
-- Method column and the Late threshold setting are removed.

UPDATE "AttendanceRecord" SET "status" = 'PRESENT' WHERE "status" = 'LATE';
UPDATE "AttendanceRecord" SET "status" = 'ABSENT' WHERE "status" = 'EXCUSED';
UPDATE "AttendanceRecord" SET "timeIn" = NULL WHERE "status" = 'ABSENT';

ALTER TYPE "AttendanceStatus" RENAME TO "AttendanceStatus_old";
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');
ALTER TABLE "AttendanceRecord" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "AttendanceRecord" ALTER COLUMN "status" TYPE "AttendanceStatus" USING ("status"::text::"AttendanceStatus");
ALTER TABLE "AttendanceRecord" ALTER COLUMN "status" SET DEFAULT 'PRESENT';
DROP TYPE "AttendanceStatus_old";

ALTER TABLE "AttendanceRecord" DROP COLUMN "method";

ALTER TABLE "Setting" DROP COLUMN "lateAfterMin";
