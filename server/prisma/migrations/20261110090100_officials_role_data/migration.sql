-- SK officials' own accounts (linked to the officials directory) get the new OFFICIAL role,
-- which opens a limited admin panel. Kept in its own migration: Postgres cannot use a new
-- enum value in the same transaction that adds it.
UPDATE "User" SET "role" = 'OFFICIAL' WHERE "officialId" IS NOT NULL AND "role" = 'VIEWER';

-- Rows not linked to an account were typed in by the admin, so they count as manual.
UPDATE "AttendanceRecord" SET "method" = 'MANUAL' WHERE "userId" IS NULL;
