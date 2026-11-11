-- Projects can be put On Hold (Ongoing -> On Hold -> Ongoing again, or -> Archives).
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';

-- An On Hold project moved to Archives (On Hold tab).
ALTER TABLE "Project" ADD COLUMN "holdArchivedAt" TIMESTAMP(3);

-- The "SK Admin account acts as an official" setting is removed.
ALTER TABLE "User" DROP COLUMN "actsAsOfficialId";
