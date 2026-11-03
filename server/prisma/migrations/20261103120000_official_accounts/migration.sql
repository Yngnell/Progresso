-- AlterTable
ALTER TABLE "User" ADD COLUMN     "officialId" TEXT,
ADD COLUMN     "pendingEmail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_officialId_key" ON "User"("officialId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_officialId_fkey" FOREIGN KEY ("officialId") REFERENCES "Official"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Login accounts for the SK officials in the directory (one per official, linked to it).
-- Each official gets a starting email and password, which they can change in My Account.
-- Only bcrypt hashes are stored; the starting passwords were handed to the SK separately.

INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "emailVerifiedAt", "officialId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, o."name", 'sehj.miranda@sksalinas1.ph', '$2a$12$5UssZknNQ9DczSohEI6hT.GtrGKs8yNlwWcOoyCCub6U06ndsPqQi', 'VIEWER', now(), o."id", now(), now()
FROM "Official" o
WHERE o."name" = 'Sehj Miranda'
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."officialId" = o."id" OR lower(u."email") = 'sehj.miranda@sksalinas1.ph')
LIMIT 1;

INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "emailVerifiedAt", "officialId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, o."name", 'kyrar.espiritu@sksalinas1.ph', '$2a$12$NAnQAIiFOW8WfYwhTHM7tekF90c4bZgfRkyl9ZmZx7T48EA1Fl6di', 'VIEWER', now(), o."id", now(), now()
FROM "Official" o
WHERE o."name" = 'Kyrar Espiritu'
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."officialId" = o."id" OR lower(u."email") = 'kyrar.espiritu@sksalinas1.ph')
LIMIT 1;

INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "emailVerifiedAt", "officialId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, o."name", 'alison.reyes@sksalinas1.ph', '$2a$12$LGf6Yhc8U/acSG4pO/Pk0eTx1JahlPmsWyis.FTXgovgXR/YS1QcC', 'VIEWER', now(), o."id", now(), now()
FROM "Official" o
WHERE o."name" = 'Alison Reyes'
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."officialId" = o."id" OR lower(u."email") = 'alison.reyes@sksalinas1.ph')
LIMIT 1;

INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "emailVerifiedAt", "officialId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, o."name", 'john.murillo@sksalinas1.ph', '$2a$12$rMSv3zsy5UdAugjkN0si8ODluf/PhdUDXUNMvM5cbiOahkxjV8VKe', 'VIEWER', now(), o."id", now(), now()
FROM "Official" o
WHERE o."name" = 'John Murillo'
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."officialId" = o."id" OR lower(u."email") = 'john.murillo@sksalinas1.ph')
LIMIT 1;

INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "emailVerifiedAt", "officialId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, o."name", 'arvin.virata@sksalinas1.ph', '$2a$12$W5MLy1HFUlbsXUx4gMfOa.JtYyqkoHR0LBzkkNGL0X4uynujPrywG', 'VIEWER', now(), o."id", now(), now()
FROM "Official" o
WHERE o."name" = 'Arvin Virata'
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."officialId" = o."id" OR lower(u."email") = 'arvin.virata@sksalinas1.ph')
LIMIT 1;

INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "emailVerifiedAt", "officialId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, o."name", 'elaine.bellon@sksalinas1.ph', '$2a$12$Ea4TNGxLpqZVp5QGhC8Lae4WpigjoDyXWrqQsPMTi9jEpWTw0.f2.', 'VIEWER', now(), o."id", now(), now()
FROM "Official" o
WHERE o."name" = 'Elaine Bellon'
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."officialId" = o."id" OR lower(u."email") = 'elaine.bellon@sksalinas1.ph')
LIMIT 1;

INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "emailVerifiedAt", "officialId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, o."name", 'ryan.sena@sksalinas1.ph', '$2a$12$dAS1B1f0s4g7LtUz0.2vV.CLa0bSafmQtGYwCR20M4EUsMQLdDRpW', 'VIEWER', now(), o."id", now(), now()
FROM "Official" o
WHERE o."name" = 'Ryan Seña'
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."officialId" = o."id" OR lower(u."email") = 'ryan.sena@sksalinas1.ph')
LIMIT 1;

INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "emailVerifiedAt", "officialId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, o."name", 'jasmin.quindoza@sksalinas1.ph', '$2a$12$9hRSIPZYlsq6KNOhITwho.TV7jf1DjIQ9zbigwyGiTCZJsn3gIcM6', 'VIEWER', now(), o."id", now(), now()
FROM "Official" o
WHERE o."name" = 'Jasmin Quindoza'
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."officialId" = o."id" OR lower(u."email") = 'jasmin.quindoza@sksalinas1.ph')
LIMIT 1;

INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "emailVerifiedAt", "officialId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, o."name", 'roby.ramos@sksalinas1.ph', '$2a$12$QZdTnrowjFboziSyxHEGYeM/qGeSQy6UBdrVohsX/pV1cfqRGO8mm', 'VIEWER', now(), o."id", now(), now()
FROM "Official" o
WHERE o."name" = 'Roby Ramos'
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."officialId" = o."id" OR lower(u."email") = 'roby.ramos@sksalinas1.ph')
LIMIT 1;

INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "emailVerifiedAt", "officialId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, o."name", 'jhay.cerdena@sksalinas1.ph', '$2a$12$Yo03.fs7z5H/Ede4B3sq/.WthAWNyo9DKPugO3vKn6Zlnsmw4GhLe', 'VIEWER', now(), o."id", now(), now()
FROM "Official" o
WHERE o."name" = 'Jhay Cerdeña'
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."officialId" = o."id" OR lower(u."email") = 'jhay.cerdena@sksalinas1.ph')
LIMIT 1;
