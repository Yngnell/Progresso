-- The Annual Budget no longer asks for a fund source or remarks. The columns stay so the
-- budgets already recorded keep their values; a new budget simply leaves them empty.
ALTER TABLE "AnnualBudget" ALTER COLUMN "fundSource" DROP NOT NULL;
