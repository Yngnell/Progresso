const prisma = require('../prisma');
const {
  CENTERS,
  QUARTERS,
  round2,
  itemsWithBalance,
  itemRemaining,
  yearSummary,
} = require('../utils/projectBudget');

// Annual Budget and ABYIP Item. The SK Admin records them; the Barangay
// Chairman can view them. Validation errors are returned per field: { message, errors: {field: text} }.

const invalid = (res, errors) =>
  res.status(400).json({ message: Object.values(errors)[0], errors });

const money = (v) => {
  const n = Number(v);
  return v === '' || v === null || v === undefined || !Number.isFinite(n) ? null : round2(n);
};
const peso = (n) => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------- Annual Budget ----------

function readBudget(body, { requireYear }) {
  const errors = {};
  const data = {};
  if (requireYear) {
    const year = Number(body.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) errors.year = 'Enter a valid year';
    else data.year = year;
  }
  const total = money(body.totalBudget);
  if (total === null) errors.totalBudget = 'The total SK budget is required';
  else if (total <= 0) errors.totalBudget = 'The total SK budget must be above zero';
  else data.totalBudget = total;
  return { data, errors };
}

// The fund source and remarks are no longer used; older budgets still have them in the database.
const budgetOut = ({ fundSource, remarks, ...b }) => b;

// GET /api/budgets — every year's budget with its allotted and unallotted amounts.
async function listBudgets(req, res, next) {
  try {
    const budgets = await prisma.annualBudget.findMany({ orderBy: { year: 'desc' } });
    const result = [];
    for (const b of budgets) {
      const s = await yearSummary(b.year);
      result.push({ ...budgetOut(b), totalBudget: s.total, allotted: s.allotted, unallotted: s.unallotted });
    }
    res.json({ budgets: result });
  } catch (err) {
    next(err);
  }
}

// POST /api/budgets — SK Admin. One budget record per year.
async function createBudget(req, res, next) {
  try {
    const { data, errors } = readBudget(req.body, { requireYear: true });
    if (Object.keys(errors).length) return invalid(res, errors);
    if (await prisma.annualBudget.findUnique({ where: { year: data.year } })) {
      return invalid(res, { year: `A budget for ${data.year} already exists. Edit it instead.` });
    }
    const budget = await prisma.annualBudget.create({ data });
    res.status(201).json({ budget: budgetOut(budget) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/budgets/:id — SK Admin. The year stays; the total cannot go below what is allotted.
async function updateBudget(req, res, next) {
  try {
    const existing = await prisma.annualBudget.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Budget not found' });
    const { data, errors } = readBudget(req.body, { requireYear: false });
    if (Object.keys(errors).length) return invalid(res, errors);
    const s = await yearSummary(existing.year);
    if (data.totalBudget < s.allotted) {
      return invalid(res, { totalBudget: `The ABYIP items of ${existing.year} already allot ${peso(s.allotted)}; the total cannot be lower.` });
    }
    const budget = await prisma.annualBudget.update({ where: { id: existing.id }, data });
    res.json({ budget: budgetOut(budget) });
  } catch (err) {
    next(err);
  }
}

// ---------- ABYIP Item ----------

function readItem(body) {
  const errors = {};
  const data = {};
  const year = Number(body.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) errors.year = 'Choose the year';
  else data.year = year;
  const name = String(body.name || '').trim();
  if (!name) errors.name = 'Enter the program or project name';
  else data.name = name.slice(0, 200);
  if (!CENTERS.includes(body.center)) errors.center = 'Choose the center of participation';
  else data.center = body.center;
  data.description = String(body.description || '').trim().slice(0, 2000) || null;
  const amount = money(body.allottedAmount);
  if (amount === null) errors.allottedAmount = 'Enter the allotted amount';
  else if (amount <= 0) errors.allottedAmount = 'The allotted amount must be above zero';
  else data.allottedAmount = amount;
  if (!QUARTERS.includes(body.targetQuarter)) errors.targetQuarter = 'Choose the target quarter';
  else data.targetQuarter = body.targetQuarter;
  return { data, errors };
}

// GET /api/abyip?year= — the ABYIP items with their remaining balances, the year's summary,
// and the choices for the form.
async function listItems(req, res, next) {
  try {
    const year = req.query.year ? Number(req.query.year) : null;
    const items = await itemsWithBalance(year ? { year } : {});
    const summary = year ? await yearSummary(year) : null;
    res.json({
      items,
      summary: summary && { total: summary.total, allotted: summary.allotted, unallotted: summary.unallotted, hasBudget: Boolean(summary.budget) },
      centers: CENTERS,
      quarters: QUARTERS,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/abyip/:id — one item with its remaining balance (Project Request shows it under the dropdown).
async function getItem(req, res, next) {
  try {
    const item = await itemRemaining(req.params.id, { excludeProjectId: req.query.excludeProject || undefined });
    if (!item) return res.status(404).json({ message: 'ABYIP item not found' });
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

// Checks the allotments of the item's year stay within the year's SK budget.
async function checkAllotment(data, excludeItemId) {
  const s = await yearSummary(data.year, { excludeItemId });
  if (!s.budget) return { year: `There is no SK budget for ${data.year} yet. Record it under Annual Budget first.` };
  if (data.allottedAmount > s.unallotted) {
    return { allottedAmount: `Only ${peso(s.unallotted)} of the ${data.year} budget is not yet allotted.` };
  }
  return null;
}

// POST /api/abyip — SK Admin.
async function createItem(req, res, next) {
  try {
    const { data, errors } = readItem(req.body);
    if (Object.keys(errors).length) return invalid(res, errors);
    const over = await checkAllotment(data);
    if (over) return invalid(res, over);
    const budget = await prisma.annualBudget.findUnique({ where: { year: data.year } });
    const item = await prisma.abyipItem.create({ data: { ...data, budgetId: budget.id } });
    res.status(201).json({ item: await itemRemaining(item.id) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/abyip/:id — SK Admin. The allotment cannot drop below what projects already use.
async function updateItem(req, res, next) {
  try {
    const existing = await itemRemaining(req.params.id);
    if (!existing) return res.status(404).json({ message: 'ABYIP item not found' });
    const { data, errors } = readItem(req.body);
    if (Object.keys(errors).length) return invalid(res, errors);
    if (data.year !== existing.year && (existing.reserved > 0 || existing.used > 0)) {
      return invalid(res, { year: 'This item already funds projects; its year cannot change.' });
    }
    const over = await checkAllotment(data, existing.id);
    if (over) return invalid(res, over);
    const committed = round2(existing.reserved + existing.used);
    if (data.allottedAmount < committed) {
      return invalid(res, { allottedAmount: `Projects already use ${peso(committed)} of this item; the allotment cannot be lower.` });
    }
    const budget = await prisma.annualBudget.findUnique({ where: { year: data.year } });
    await prisma.abyipItem.update({ where: { id: existing.id }, data: { ...data, budgetId: budget.id } });
    res.json({ item: await itemRemaining(existing.id) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listBudgets, createBudget, updateBudget, listItems, getItem, createItem, updateItem };
