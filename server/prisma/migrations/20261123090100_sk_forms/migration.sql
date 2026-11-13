-- SK project process (part 2 of 2): annual budgets, ABYIP items, budget rows, reviews,
-- progress updates; new project, expense, file and attendance columns; existing data moved over.
-- Nothing is dropped or renamed.

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "category" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "fileId" TEXT,
ADD COLUMN     "supplier" TEXT;

-- AlterTable
ALTER TABLE "LiquidationFile" ADD COLUMN     "description" TEXT,
ADD COLUMN     "documentType" TEXT NOT NULL DEFAULT 'RECEIPT';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "abyipItemId" TEXT,
ADD COLUMN     "accomplishmentSummary" TEXT,
ADD COLUMN     "actualEndDate" TIMESTAMP(3),
ADD COLUMN     "actualParticipants" INTEGER,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "cancelDate" TIMESTAMP(3),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "estimatedCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "objectives" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "targetParticipants" INTEGER,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "AnnualBudget" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "totalBudget" DECIMAL(14,2) NOT NULL,
    "fundSource" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnualBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbyipItem" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "center" TEXT NOT NULL,
    "description" TEXT,
    "allottedAmount" DECIMAL(14,2) NOT NULL,
    "targetQuarter" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbyipItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectBudgetRow" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectBudgetRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectReview" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "remarks" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressUpdate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestone" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "percent" INTEGER NOT NULL,
    "notes" TEXT,
    "photoId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnnualBudget_year_key" ON "AnnualBudget"("year");

-- CreateIndex
CREATE INDEX "AbyipItem_year_idx" ON "AbyipItem"("year");

-- CreateIndex
CREATE INDEX "ProjectBudgetRow_projectId_idx" ON "ProjectBudgetRow"("projectId");

-- CreateIndex
CREATE INDEX "ProjectReview_projectId_reviewedAt_idx" ON "ProjectReview"("projectId", "reviewedAt");

-- CreateIndex
CREATE INDEX "ProgressUpdate_projectId_date_idx" ON "ProgressUpdate"("projectId", "date");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_abyipItemId_fkey" FOREIGN KEY ("abyipItemId") REFERENCES "AbyipItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "LiquidationFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbyipItem" ADD CONSTRAINT "AbyipItem_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "AnnualBudget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBudgetRow" ADD CONSTRAINT "ProjectBudgetRow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectReview" ADD CONSTRAINT "ProjectReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectReview" ADD CONSTRAINT "ProjectReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressUpdate" ADD CONSTRAINT "ProgressUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressUpdate" ADD CONSTRAINT "ProgressUpdate_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressUpdate" ADD CONSTRAINT "ProgressUpdate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------- existing data on the new process ----------

-- Statuses: Proposed -> Pending, Planning -> Approved, On Hold -> Ongoing (or Cancelled when it
-- had been moved to Archives), a rejected request -> Rejected.
UPDATE "Project" SET "submittedAt" = "createdAt" WHERE "status" = 'PROPOSED';
UPDATE "Project" SET "status" = CASE
    WHEN "status" = 'PROPOSED' THEN 'PENDING'::"ProjectStatus"
    WHEN "status" = 'PLANNING' THEN 'APPROVED'::"ProjectStatus"
    WHEN "status" = 'ON_HOLD' AND "holdArchivedAt" IS NOT NULL THEN 'CANCELLED'::"ProjectStatus"
    WHEN "status" = 'ON_HOLD' THEN 'ONGOING'::"ProjectStatus"
    WHEN "status" = 'CANCELLED' AND "approvalState" = 'REJECTED' THEN 'REJECTED'::"ProjectStatus"
    ELSE "status"
  END;
UPDATE "Project" SET "cancelReason" = COALESCE("cancelReason", 'Moved to Archives while on hold'),
                     "cancelledAt" = "holdArchivedAt", "cancelDate" = "holdArchivedAt"
  WHERE "holdArchivedAt" IS NOT NULL AND "status" = 'CANCELLED';
UPDATE "Project" SET "approvedAt" = "reviewedAt"
  WHERE "approvalState" = 'APPROVED' AND "reviewedAt" IS NOT NULL;
UPDATE "Project" SET "startedAt" = COALESCE("startDate", "updatedAt") WHERE "status" IN ('ONGOING', 'COMPLETED');

-- The purchase request rows become the budget breakdown (one row each, at its estimated amount),
-- and the estimated cost is their total (or the old budget when a project had no rows).
INSERT INTO "ProjectBudgetRow" ("id", "projectId", "item", "quantity", "unitCost", "total", "displayOrder")
SELECT "id", "projectId",
       TRIM(BOTH ' ' FROM CONCAT('Purchase request ', COALESCE("prNo", ''), CASE WHEN "requestedBy" IS NOT NULL THEN ' (' || "requestedBy" || ')' ELSE '' END)),
       1, "amount", "amount", "displayOrder"
  FROM "ProjectRequestItem";
UPDATE "Project" p SET "estimatedCost" = COALESCE(
  (SELECT SUM(r."total") FROM "ProjectBudgetRow" r WHERE r."projectId" = p."id"), p."budget");

-- The chairman's earlier decisions start the review history.
INSERT INTO "ProjectReview" ("id", "projectId", "decision", "remarks", "reviewerId", "reviewedAt")
SELECT gen_random_uuid()::text, "id",
       CASE WHEN "approvalState" = 'APPROVED' THEN 'APPROVE' ELSE 'REJECT' END,
       "reviewRemarks", "reviewedById", "reviewedAt"
  FROM "Project"
 WHERE "reviewedAt" IS NOT NULL AND "approvalState" IN ('APPROVED', 'REJECTED');

-- One project file module: the purchase request files join the receipts as typed files.
INSERT INTO "LiquidationFile" ("id", "projectId", "fileName", "originalName", "mimeType", "uploadedById", "uploadedByName", "documentType", "createdAt")
SELECT "id", "projectId", "fileName", "originalName", "mimeType", "uploadedById", "uploadedByName", 'PURCHASE_REQUEST', "createdAt"
  FROM "PurchaseRequestFile"
ON CONFLICT ("id") DO NOTHING;

-- Attendance records take the project of their meeting.
UPDATE "AttendanceRecord" a SET "projectId" = e."relatedProjectId"
  FROM "Event" e WHERE a."eventId" = e."id" AND e."relatedProjectId" IS NOT NULL;
