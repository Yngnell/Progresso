-- Undoes 20261118090000_sk_project_process: back to the earlier project flow.
--   PENDING_APPROVAL -> PROPOSED, APPROVED -> PLANNING,
--   PURCHASING / FUND_RELEASE / IMPLEMENTATION / LIQUIDATION -> ONGOING,
--   COMPLETED -> COMPLETED, REJECTED -> CANCELLED, ON_HOLD -> ON_HOLD,
--   ARCHIVED -> ON_HOLD (moved to Archives) if it was an archived On Hold project, else COMPLETED.
-- The "Official Receipts or Sales Invoices" uploads go back to the receipt liquidation files.

-- 1. The receipt liquidation and checklist tables again
CREATE TABLE "LiquidationFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiquidationFile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LiquidationFile_projectId_idx" ON "LiquidationFile"("projectId");
ALTER TABLE "LiquidationFile" ADD CONSTRAINT "LiquidationFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChecklistItem_projectId_idx" ON "ChecklistItem"("projectId");
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "LiquidationFile" ("id", "projectId", "fileName", "originalName", "mimeType", "uploadedById", "uploadedByName", "createdAt")
SELECT d."id", d."projectId", d."fileUrl", d."originalName", d."mimeType", d."uploadedById", u."name", d."uploadedAt"
  FROM "ProjectDocument" d
  JOIN "RequiredDocument" rd ON rd."id" = d."requiredDocumentId"
  LEFT JOIN "User" u ON u."id" = d."uploadedById"
 WHERE rd."stage" = 'LIQUIDATION' AND rd."name" = 'Official Receipts or Sales Invoices';

-- 2. Drop the documents, the stage history and the request alerts
DROP TABLE "ProjectStageLog";
DROP TABLE "ProjectDocument";
DROP TABLE "RequiredDocument";
DELETE FROM "Notification" WHERE "type" IN ('REQUEST_SUBMITTED', 'REQUEST_APPROVED', 'REQUEST_REJECTED');

-- 3. Project fields of the SK process
ALTER TABLE "Project"
  DROP COLUMN "abyipItem",
  DROP COLUMN "amountSpent",
  DROP COLUMN "amountReturned",
  DROP COLUMN "rejectionRemarks",
  DROP COLUMN "submittedAt",
  DROP COLUMN "heldFromStatus";

-- 4. The earlier stages
CREATE TYPE "ProjectStatus_old" AS ENUM ('PROPOSED', 'PLANNING', 'ONGOING', 'COMPLETED', 'CANCELLED', 'ON_HOLD');
ALTER TABLE "Project" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "status" TYPE "ProjectStatus_old" USING (
  CASE
    WHEN "status"::text = 'PENDING_APPROVAL' THEN 'PROPOSED'
    WHEN "status"::text = 'APPROVED' THEN 'PLANNING'
    WHEN "status"::text IN ('PURCHASING', 'FUND_RELEASE', 'IMPLEMENTATION', 'LIQUIDATION') THEN 'ONGOING'
    WHEN "status"::text = 'REJECTED' THEN 'CANCELLED'
    WHEN "status"::text = 'ON_HOLD' THEN 'ON_HOLD'
    WHEN "status"::text = 'ARCHIVED' AND "holdArchivedAt" IS NOT NULL THEN 'ON_HOLD'
    ELSE 'COMPLETED'
  END
)::"ProjectStatus_old";
DROP TYPE "ProjectStatus";
ALTER TYPE "ProjectStatus_old" RENAME TO "ProjectStatus";
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'PROPOSED';
