-- Project items, supplier quotations (canvass) and receipt amounts. Additive only.

-- AlterTable
ALTER TABLE "LiquidationFile" ADD COLUMN     "amount" DECIMAL(12,2),
ADD COLUMN     "readStatus" TEXT,
ADD COLUMN     "receiptDate" TIMESTAMP(3),
ADD COLUMN     "storeName" TEXT;

-- CreateTable
CREATE TABLE "ProjectItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "estUnitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectQuotation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierAddress" TEXT,
    "prices" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectItem_projectId_idx" ON "ProjectItem"("projectId");

-- CreateIndex
CREATE INDEX "ProjectQuotation_projectId_idx" ON "ProjectQuotation"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectItem" ADD CONSTRAINT "ProjectItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectQuotation" ADD CONSTRAINT "ProjectQuotation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

