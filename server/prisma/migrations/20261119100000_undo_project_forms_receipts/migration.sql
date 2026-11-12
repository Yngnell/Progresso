-- Undoes 20261119090000_project_forms_receipts: removes the project items, the supplier
-- quotations and the receipt amount columns. Projects and receipt files are kept.
DROP TABLE "ProjectQuotation";
DROP TABLE "ProjectItem";
ALTER TABLE "LiquidationFile"
  DROP COLUMN "amount",
  DROP COLUMN "receiptDate",
  DROP COLUMN "storeName",
  DROP COLUMN "readStatus";
