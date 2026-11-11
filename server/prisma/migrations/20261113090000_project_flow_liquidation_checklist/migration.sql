-- Project flow: Project Request -> Proposed -> Planning -> Ongoing -> Completed,
-- and Proposed -> Cancelled when the Barangay Chairman rejects it.

-- Receipt liquidation files and the optional checklist of each project.
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

-- Existing projects onto the new flow (the status values themselves are unchanged).
-- A rejected proposal is Cancelled.
UPDATE "Project" SET "status" = 'CANCELLED' WHERE "approvalState" = 'REJECTED';
-- "Returned for revision" no longer exists: those proposals wait for a decision again.
UPDATE "Project" SET "approvalState" = 'PENDING', "reviewedById" = NULL, "reviewedAt" = NULL
  WHERE "status" = 'PROPOSED' AND "approvalState" = 'RETURNED';
-- An approved project in Planning that already has its schedule is Ongoing.
UPDATE "Project" SET "status" = 'ONGOING'
  WHERE "status" = 'PLANNING' AND "approvalState" = 'APPROVED'
    AND "startDate" IS NOT NULL AND "endDate" IS NOT NULL AND "endDate" > "startDate";

-- Keep the proof files already uploaded for expenses as liquidation files.
INSERT INTO "LiquidationFile" ("id", "projectId", "fileName", "originalName", "mimeType", "createdAt")
  SELECT "id", "projectId", "receiptFile", COALESCE("receiptName", "receiptFile"),
         COALESCE("receiptType", 'application/octet-stream'), "createdAt"
  FROM "Expense" WHERE "receiptFile" IS NOT NULL;
