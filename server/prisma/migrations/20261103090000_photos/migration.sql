-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "eventId" TEXT,
    "caption" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Photo_projectId_idx" ON "Photo"("projectId");

-- CreateIndex
CREATE INDEX "Photo_eventId_idx" ON "Photo"("eventId");

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

