const prisma = require('../prisma');

// The one place where money is computed (never trust a balance sent by the browser).
//   Unallotted budget of a year  = the year's SK budget - the allotments of its ABYIP items
//   Remaining balance of an ABYIP item = allotted amount
//       - the estimated cost of its Approved and Ongoing projects (reserved)
//       - the actual cost of its Completed projects (sum of their expenses)
//       - the spent amount of its Cancelled projects (sum of their expenses)
//   Remaining balance of a project  = its approved (estimated) cost - the sum of its expenses

const CENTERS = [
  'Education', 'Health', 'Sports', 'Environment', 'Active Citizenship', 'Economic Empowerment',
  'Social Inclusion and Equity', 'Peace Building and Security', 'Governance', 'Global Mobility', 'Agriculture',
];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
// What an expense was for. Detected from the receipt when it is read (it can be changed).
const EXPENSE_CATEGORIES = [
  'Food and Refreshments', 'Supplies and Materials', 'Venue and Equipment Rental', 'Transportation',
  'Honoraria and Prizes', 'Printing and Documentation', 'Other Expenses',
];
const RESERVING = ['APPROVED', 'ONGOING'];
const SPENDING = ['COMPLETED', 'CANCELLED'];

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// Sum of the recorded expenses of each project: { [projectId]: amount }.
async function spentByProject(projectIds) {
  if (!projectIds.length) return {};
  const rows = await prisma.expense.groupBy({
    by: ['projectId'],
    where: { projectId: { in: projectIds } },
    _sum: { amount: true },
  });
  return Object.fromEntries(rows.map((r) => [r.projectId, round2(r._sum.amount)]));
}

// How much of each ABYIP item is used: { [itemId]: { reserved, used, committed } }.
// excludeProjectId leaves one project out (e.g. the request being checked).
async function usageByItem(itemIds, { excludeProjectId } = {}) {
  if (!itemIds.length) return {};
  const projects = await prisma.project.findMany({
    where: {
      abyipItemId: { in: itemIds },
      status: { in: [...RESERVING, ...SPENDING] },
      archivedAt: null,
      ...(excludeProjectId ? { id: { not: excludeProjectId } } : {}),
    },
    select: { id: true, abyipItemId: true, status: true, estimatedCost: true },
  });
  const spent = await spentByProject(projects.filter((p) => SPENDING.includes(p.status)).map((p) => p.id));
  const usage = Object.fromEntries(itemIds.map((id) => [id, { reserved: 0, used: 0, committed: 0 }]));
  for (const p of projects) {
    const u = usage[p.abyipItemId];
    if (RESERVING.includes(p.status)) u.reserved = round2(u.reserved + Number(p.estimatedCost));
    else u.used = round2(u.used + (spent[p.id] || 0));
  }
  for (const u of Object.values(usage)) u.committed = round2(u.reserved + u.used);
  return usage;
}

// ABYIP items with their balances.
async function itemsWithBalance(where = {}, opts = {}) {
  const items = await prisma.abyipItem.findMany({
    where,
    orderBy: [{ year: 'desc' }, { targetQuarter: 'asc' }, { name: 'asc' }],
  });
  const usage = await usageByItem(items.map((i) => i.id), opts);
  return items.map((i) => {
    const u = usage[i.id];
    return {
      ...i,
      allottedAmount: round2(i.allottedAmount),
      reserved: u.reserved,
      used: u.used,
      remaining: round2(Number(i.allottedAmount) - u.committed),
    };
  });
}

// One item's remaining balance (null when the item does not exist).
async function itemRemaining(itemId, opts = {}) {
  const [item] = await itemsWithBalance({ id: itemId }, opts);
  return item || null;
}

// A year's SK budget, its allotments and the part not yet allotted.
async function yearSummary(year, { excludeItemId } = {}) {
  const budget = await prisma.annualBudget.findUnique({ where: { year } });
  const agg = await prisma.abyipItem.aggregate({
    where: { year, ...(excludeItemId ? { id: { not: excludeItemId } } : {}) },
    _sum: { allottedAmount: true },
  });
  const total = budget ? round2(budget.totalBudget) : 0;
  const allotted = round2(agg._sum.allottedAmount);
  return { budget, total, allotted, unallotted: round2(total - allotted) };
}

// A project's money: approved (estimated) cost, spent so far, remaining.
async function projectMoney(project) {
  const spent = (await spentByProject([project.id]))[project.id] || 0;
  const approvedCost = round2(project.estimatedCost);
  return { approvedCost, spent, remaining: round2(approvedCost - spent) };
}

module.exports = {
  CENTERS,
  QUARTERS,
  EXPENSE_CATEGORIES,
  round2,
  spentByProject,
  usageByItem,
  itemsWithBalance,
  itemRemaining,
  yearSummary,
  projectMoney,
};
