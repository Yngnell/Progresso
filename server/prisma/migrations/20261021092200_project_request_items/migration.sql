-- CreateTable
CREATE TABLE "ProjectRequestItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "prNo" TEXT,
    "prDate" TIMESTAMP(3),
    "requestedBy" TEXT,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectRequestItem_projectId_idx" ON "ProjectRequestItem"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectRequestItem" ADD CONSTRAINT "ProjectRequestItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
