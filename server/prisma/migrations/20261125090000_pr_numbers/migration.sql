-- Purchase Requests get a PR No. in the SKFPD format MM-NNN-YYYY (month, number in the month,
-- year), given by the system when the file is uploaded. Other files leave it empty.
ALTER TABLE "LiquidationFile" ADD COLUMN "prNo" TEXT;
CREATE UNIQUE INDEX "LiquidationFile_prNo_key" ON "LiquidationFile"("prNo");
