const prisma = require('../prisma');

// The Overall Budget: the budgets of the projects in the Projects module minus every receipt
// saved in their Receipt Liquidation. Deleted projects (archivedAt) and cancelled (rejected)
// Project Requests are left out: they hold no money. With projectId, only that project (its
// Remaining Budget). Computed from the database each time, so adding, editing or deleting a
// receipt or a project changes it right away.
const round2 = (n) => Math.round(n * 100) / 100;

async function overallBudget(projectId = null) {
  const projectWhere = { archivedAt: null, status: { not: 'CANCELLED' }, ...(projectId ? { id: projectId } : {}) };
  const [budgets, receipts] = await Promise.all([
    prisma.project.aggregate({ where: projectWhere, _sum: { budget: true } }),
    prisma.liquidationFile.aggregate({ where: { project: projectWhere }, _sum: { amount: true } }),
  ]);
  const totalBudget = round2(Number(budgets._sum.budget || 0));
  const totalSpent = round2(Number(receipts._sum.amount || 0));
  return { totalBudget, totalSpent, remaining: round2(totalBudget - totalSpent) };
}

module.exports = { overallBudget, round2 };
