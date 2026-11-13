-- SK project process (part 1 of 2): the new project statuses. PostgreSQL cannot use a new
-- enum value in the same transaction that adds it, so the data changes are in part 2.
-- The earlier values (PROPOSED, PLANNING, ON_HOLD) stay in the type, unused.
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'FOR_REVISION';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
