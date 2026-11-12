-- The SK Admin and Barangay Chairman accounts move from the seed's sample addresses to the
-- SK's real Gmail inboxes (alerts are emailed to each account's registered email).
-- Same accounts, passwords and history; only the email changes. Skipped if an account with
-- the new address already exists, so the unique email index is never violated.
UPDATE "User" SET "email" = 'admin.sksalinas1@gmail.com'
 WHERE "email" = 'admin@sk.gov.ph'
   AND NOT EXISTS (SELECT 1 FROM "User" WHERE "email" = 'admin.sksalinas1@gmail.com');

UPDATE "User" SET "email" = 'chairman.sksalinas1@gmail.com'
 WHERE "email" = 'chairman@sk.gov.ph'
   AND NOT EXISTS (SELECT 1 FROM "User" WHERE "email" = 'chairman.sksalinas1@gmail.com');
