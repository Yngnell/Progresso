-- The SK project process: new stages, required documents per stage, uploaded documents
-- and the stage history. Existing projects are mapped to the nearest new stage:
--   PROPOSED -> PENDING_APPROVAL (already submitted), PLANNING -> APPROVED,
--   ONGOING -> IMPLEMENTATION, ON_HOLD -> ON_HOLD (resumes at Implementation),
--   COMPLETED -> COMPLETED, CANCELLED -> REJECTED, an On Hold project moved to Archives -> ARCHIVED.
-- Deleted projects (archivedAt) keep their stage and stay deleted.

-- 1. The new stages
CREATE TYPE "ProjectStatus_new" AS ENUM (
  'PENDING_APPROVAL', 'APPROVED', 'PURCHASING', 'FUND_RELEASE', 'IMPLEMENTATION',
  'LIQUIDATION', 'COMPLETED', 'REJECTED', 'ON_HOLD', 'ARCHIVED'
);
ALTER TABLE "Project" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "status" TYPE "ProjectStatus_new" USING (
  CASE
    WHEN "holdArchivedAt" IS NOT NULL THEN 'ARCHIVED'
    WHEN "status"::text = 'PROPOSED' THEN 'PENDING_APPROVAL'
    WHEN "status"::text = 'PLANNING' THEN 'APPROVED'
    WHEN "status"::text = 'ONGOING' THEN 'IMPLEMENTATION'
    WHEN "status"::text = 'ON_HOLD' THEN 'ON_HOLD'
    WHEN "status"::text = 'COMPLETED' THEN 'COMPLETED'
    ELSE 'REJECTED'
  END
)::"ProjectStatus_new";
ALTER TYPE "ProjectStatus" RENAME TO "ProjectStatus_old";
ALTER TYPE "ProjectStatus_new" RENAME TO "ProjectStatus";
DROP TYPE "ProjectStatus_old";
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';

-- 2. New project fields
ALTER TABLE "Project"
  ADD COLUMN "abyipItem" TEXT,
  ADD COLUMN "amountSpent" DECIMAL(12,2),
  ADD COLUMN "amountReturned" DECIMAL(12,2),
  ADD COLUMN "rejectionRemarks" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "heldFromStatus" "ProjectStatus";

UPDATE "Project" SET "submittedAt" = "createdAt" WHERE "status" = 'PENDING_APPROVAL';
UPDATE "Project" SET "heldFromStatus" = 'IMPLEMENTATION' WHERE "status" = 'ON_HOLD';
UPDATE "Project"
   SET "rejectionRemarks" = COALESCE("reviewRemarks", "cancelReason"),
       "approvalState" = 'REJECTED'
 WHERE "status" = 'REJECTED';

-- 3. Required documents per stage
CREATE TABLE "RequiredDocument" (
    "id" TEXT NOT NULL,
    "stage" "ProjectStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "minFiles" INTEGER NOT NULL DEFAULT 1,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RequiredDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RequiredDocument_stage_name_key" ON "RequiredDocument"("stage", "name");
CREATE INDEX "RequiredDocument_stage_idx" ON "RequiredDocument"("stage");

INSERT INTO "RequiredDocument" ("id", "stage", "name", "minFiles", "displayOrder") VALUES
  ('rd-pending-proposal',     'PENDING_APPROVAL', 'Project Proposal', 1, 1),
  ('rd-pending-resolution',   'PENDING_APPROVAL', 'SK Resolution', 1, 2),
  ('rd-pending-minutes',      'PENDING_APPROVAL', 'Meeting Minutes', 1, 3),
  ('rd-purchase-request',     'PURCHASING', 'Purchase Request', 1, 1),
  ('rd-purchase-canvass',     'PURCHASING', 'Supplier Canvass', 3, 2),
  ('rd-purchase-abstract',    'PURCHASING', 'Abstract of Canvass', 1, 3),
  ('rd-purchase-order',       'PURCHASING', 'Purchase Order', 1, 4),
  ('rd-fund-obligation',      'FUND_RELEASE', 'Obligation Request', 1, 1),
  ('rd-fund-voucher',         'FUND_RELEASE', 'Disbursement Voucher', 1, 2),
  ('rd-fund-check',           'FUND_RELEASE', 'Check or Cash Advance Record', 1, 3),
  ('rd-impl-attendance',      'IMPLEMENTATION', 'Attendance Sheet', 1, 1),
  ('rd-impl-photos',          'IMPLEMENTATION', 'Activity Photos', 3, 2),
  ('rd-impl-delivery',        'IMPLEMENTATION', 'Delivery Receipt', 1, 3),
  ('rd-impl-inspection',      'IMPLEMENTATION', 'Inspection or Acceptance Report', 1, 4),
  ('rd-liq-report',           'LIQUIDATION', 'Liquidation Report', 1, 1),
  ('rd-liq-receipts',         'LIQUIDATION', 'Official Receipts or Sales Invoices', 1, 2)
ON CONFLICT ("stage", "name") DO NOTHING;

-- 4. Uploaded documents
CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requiredDocumentId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "isChecked" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectDocument_projectId_idx" ON "ProjectDocument"("projectId");
CREATE INDEX "ProjectDocument_requiredDocumentId_idx" ON "ProjectDocument"("requiredDocumentId");
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_requiredDocumentId_fkey"
  FOREIGN KEY ("requiredDocumentId") REFERENCES "RequiredDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Stage history
CREATE TABLE "ProjectStageLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromStatus" "ProjectStatus",
    "toStatus" "ProjectStatus" NOT NULL,
    "remarks" TEXT,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectStageLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectStageLog_projectId_changedAt_idx" ON "ProjectStageLog"("projectId", "changedAt");
ALTER TABLE "ProjectStageLog" ADD CONSTRAINT "ProjectStageLog_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectStageLog" ADD CONSTRAINT "ProjectStageLog_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. The old receipt liquidation files become each project's
--    "Official Receipts or Sales Invoices" (already reviewed, so checked).
INSERT INTO "ProjectDocument" ("id", "projectId", "requiredDocumentId", "fileUrl", "originalName", "mimeType", "isChecked", "uploadedById", "uploadedAt")
SELECT l."id", l."projectId", rd."id", l."fileName", l."originalName", l."mimeType", true,
       (SELECT u."id" FROM "User" u WHERE u."id" = l."uploadedById"), l."createdAt"
  FROM "LiquidationFile" l
  JOIN "RequiredDocument" rd ON rd."stage" = 'LIQUIDATION' AND rd."name" = 'Official Receipts or Sales Invoices';

-- 7. The old receipt and free-form checklist tables are replaced by the documents above.
DROP TABLE "LiquidationFile";
DROP TABLE "ChecklistItem";
