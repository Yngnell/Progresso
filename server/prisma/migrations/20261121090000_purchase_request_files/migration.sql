-- Purchase Request files: scanned or signed PR forms attached to a project. Additive only.

-- CreateTable
CREATE TABLE "PurchaseRequestFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequestFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseRequestFile_projectId_idx" ON "PurchaseRequestFile"("projectId");

-- AddForeignKey
ALTER TABLE "PurchaseRequestFile" ADD CONSTRAINT "PurchaseRequestFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

