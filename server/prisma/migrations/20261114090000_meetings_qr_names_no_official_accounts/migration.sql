-- Attendance by name: the QR code opens a page where an SK official picks their name.
-- Attendance records are linked to the SK officials table (not to login accounts), the
-- SK officials' login accounts are removed, and profile pictures are dropped.

-- 1) Link attendance to the SK officials table.
ALTER TABLE "AttendanceRecord" ADD COLUMN "officialId" TEXT;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_officialId_fkey"
  FOREIGN KEY ("officialId") REFERENCES "Official"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Records made with an official's account point to that official.
UPDATE "AttendanceRecord" a SET "officialId" = u."officialId"
  FROM "User" u
  WHERE a."userId" = u."id" AND u."officialId" IS NOT NULL;

-- Older records typed in by name point to the official with that name (once per meeting).
UPDATE "AttendanceRecord" a SET "officialId" = o."id"
  FROM "Official" o
  WHERE a."officialId" IS NULL
    AND lower(trim(a."participant")) = lower(trim(o."name"))
    AND NOT EXISTS (
      SELECT 1 FROM "AttendanceRecord" b WHERE b."eventId" = a."eventId" AND b."officialId" = o."id"
    );

CREATE UNIQUE INDEX "AttendanceRecord_eventId_officialId_key" ON "AttendanceRecord"("eventId", "officialId");

-- 2) Remove the SK officials' login accounts. Their names stay in "Official" and their
--    attendance stays. Projects and news they created now belong to the SK Admin account.
UPDATE "Project" SET "createdById" = (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" LIMIT 1)
  WHERE "createdById" IN (SELECT "id" FROM "User" WHERE "role" = 'OFFICIAL');
UPDATE "Project" SET "reviewedById" = NULL
  WHERE "reviewedById" IN (SELECT "id" FROM "User" WHERE "role" = 'OFFICIAL');
UPDATE "News" SET "authorId" = (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" LIMIT 1)
  WHERE "authorId" IN (SELECT "id" FROM "User" WHERE "role" = 'OFFICIAL');
DELETE FROM "User" WHERE "role" = 'OFFICIAL';

-- 3) No more profile pictures.
ALTER TABLE "User" DROP COLUMN "photoUrl";
ALTER TABLE "Official" DROP COLUMN "photoUrl";
