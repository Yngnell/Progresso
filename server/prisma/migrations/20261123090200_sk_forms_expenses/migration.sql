-- Form 6 (Expense) is now where project spending is recorded. Receipts that already carry an
-- amount (read by Claude or typed by the SK Admin) become expenses linked to their receipt file,
-- so no spending is lost. Each receipt is converted once; nothing is dropped.
INSERT INTO "Expense" ("id", "projectId", "item", "amount", "date", "category", "supplier", "fileId", "createdById", "createdAt")
SELECT gen_random_uuid(),
       f."projectId",
       COALESCE(NULLIF(f."storeName", ''), 'Receipt ' || f."originalName"),
       f."amount",
       COALESCE(f."receiptDate", f."createdAt"),
       'Other Expenses',
       NULLIF(f."storeName", ''),
       f."id",
       u."id",
       f."createdAt"
FROM "LiquidationFile" f
LEFT JOIN "User" u ON u."id" = f."uploadedById"
WHERE f."amount" IS NOT NULL
  AND f."documentType" = 'RECEIPT'
  AND NOT EXISTS (SELECT 1 FROM "Expense" e WHERE e."fileId" = f."id");
