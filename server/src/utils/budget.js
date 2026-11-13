const prisma = require('../prisma');
const { round2, projectMoney, yearSummary, itemsWithBalance } = require('./projectBudget');

// The Overall Budget on the Dashboard: this year's SK budget (Annual Budget) minus every expense
// (Expense) of the projects it funds. Deleted projects are left out. With projectId, that
// project's approved cost, what it has spent and what is left of it (its Remaining Budget).
// Computed from the database each time, so a new expense or budget shows right away.
//   { year, totalBudget, totalSpent, remaining, reserved, hasBudget }
async function overallBudget(projectId = null) {
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, estimatedCost: true } });
    if (!project) return { totalBudget: 0, totalSpent: 0, remaining: 0 };
    const m = await projectMoney(project);
    return { totalBudget: m.approvedCost, totalSpent: m.spent, remaining: m.remaining };
  }
  const year = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }).slice(0, 4));
  const [summary, items] = await Promise.all([yearSummary(year), itemsWithBalance({ year })]);
  const spent = await prisma.expense.aggregate({
    where: { project: { archivedAt: null, abyipItem: { year } } },
    _sum: { amount: true },
  });
  const totalSpent = round2(spent._sum.amount);
  return {
    year,
    hasBudget: Boolean(summary.budget),
    totalBudget: summary.total,
    totalSpent,
    remaining: round2(summary.total - totalSpent),
    // The approved costs still set aside for Approved and Ongoing projects.
    reserved: round2(items.reduce((s, i) => s + i.reserved, 0)),
  };
}

module.exports = { overallBudget, round2 };
