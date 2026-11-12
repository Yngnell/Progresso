-- From now on only new alerts about upcoming meetings and projects are emailed.
-- Mark every alert that exists today as already handled, so none of them is ever emailed
-- (to the SK Admin and Barangay Chairman, or to residents who asked for updates).
UPDATE "Notification" SET "emailedAt" = NOW() WHERE "emailedAt" IS NULL;
UPDATE "Notification" SET "viewerEmailedAt" = NOW() WHERE "viewerEmailedAt" IS NULL;
