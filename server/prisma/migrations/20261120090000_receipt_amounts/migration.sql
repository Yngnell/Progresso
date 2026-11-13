-- Receipt amounts: what each liquidation receipt says (read by Claude or typed). Additive only.

-- AlterTable
ALTER TABLE "LiquidationFile" ADD COLUMN     "amount" DECIMAL(12,2),
ADD COLUMN     "readStatus" TEXT,
ADD COLUMN     "receiptDate" TIMESTAMP(3),
ADD COLUMN     "storeName" TEXT;

