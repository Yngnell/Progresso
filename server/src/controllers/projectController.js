const crypto = require('crypto');
const prisma = require('../prisma');
const { parsePhDate } = require('../utils/phTime');
const { readReceipt, toReceiptFields, isReaderConfigured } = require('../utils/receiptReader');
const { receiptPath, removeReceiptFile } = require('../middleware/upload');
const { photosForProject } = require('./photoController');
const { isStaff } = require('../utils/roles');

// Project flow (each step only to the next one; skipped stages are refused):
//   Project Request -> PROPOSED -> PLANNING -> ONGOING -> COMPLETED
//   PROPOSED -> CANCELLED when the Barangay Chairman rejects it
//   ONGOING -> ON_HOLD (paused) -> ONGOING again (Resume), or -> Archives (On Hold tab)
// - PROPOSED: the Barangay Chairman approves (-> PLANNING) or rejects (-> CANCELLED).
// - PLANNING: the SK Admin saves the schedule (start and end) -> ONGOING.
// - ONGOING: the SK Admin uploads the receipt liquidation (required) and keeps an optional
//   checklist; "Project Completed" -> COMPLETED once both are done.
// - ON_HOLD: paused; no liquidation, checklist or completion until it is resumed.
// Completed, cancelled and archived On Hold projects are shown in Archives and are view only.

// Archived (deleted) projects are kept for the record but cannot be changed.
const ARCHIVED_MESSAGE = 'This project is archived and can no longer be changed';
const CLOSED_MESSAGE = 'This project is closed and can only be viewed';
// Asking to delete a project needs a real reason (the client checks the same).
const MIN_REASON_LENGTH = 10;

// Shared include so lists and details always carry the team, creator, the latest deletion
// request, the purchase requests, the liquidation files and the checklist.
const includeOpts = {
  officials: { orderBy: { displayOrder: 'asc' } },
  createdBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  // Latest deletion request (any status) so the UI can show pending/rejected.
  deletionRequests: { orderBy: { createdAt: 'desc' }, take: 1 },
  requestItems: { orderBy: { displayOrder: 'asc' } },
  liquidationFiles: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      uploadedByName: true,
      createdAt: true,
      amount: true,
      receiptDate: true,
      storeName: true,
      readStatus: true,
    },
  },
  checklistItems: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] },
  items: { orderBy: { displayOrder: 'asc' } },
  quotations: { orderBy: { createdAt: 'asc' } },
};

const round2 = (n) => Math.round(n * 100) / 100;

// The canvass: each quotation's total for the project's items, and the winner: the lowest
// quotation that prices every item (the Abstract of Canvass and the Purchase Order use it).
function canvassInfo(project) {
  const items = project.items || [];
  const quotations = (project.quotations || []).map((q) => {
    const prices = q.prices || {};
    const priced = items.filter((i) => prices[i.id] !== undefined && prices[i.id] !== null && prices[i.id] !== '');
    const total = round2(priced.reduce((sum, i) => sum + Number(prices[i.id]) * i.quantity, 0));
    return { ...q, total, complete: items.length > 0 && priced.length === items.length };
  });
  const complete = quotations.filter((q) => q.complete);
  const winner = complete.length ? complete.reduce((best, q) => (q.total < best.total ? q : best)) : null;
  return {
    quotations,
    itemsTotal: round2(items.reduce((sum, i) => sum + Number(i.estUnitCost) * i.quantity, 0)),
    winningQuotationId: winner ? winner.id : null,
  };
}

// Receipt amounts: what was spent so far and what goes back (budget - spent).
function liquidationTotals(project) {
  const files = project.liquidationFiles || [];
  const spent = round2(files.reduce((sum, f) => sum + (f.amount == null ? 0 : Number(f.amount)), 0));
  return {
    amountSpent: spent,
    amountToRefund: round2(Number(project.budget || 0) - spent),
    receiptsWithoutAmount: files.filter((f) => f.amount == null).length,
    receiptReading: isReaderConfigured(),
  };
}

// What still stands between an Ongoing project and "Project Completed".
function completionInfo(project) {
  const files = (project.liquidationFiles || []).length;
  const items = project.checklistItems || [];
  const open = items.filter((i) => !i.done).length;
  const missing = [];
  if (files === 0) missing.push('Upload at least one receipt liquidation file.');
  if (open > 0) missing.push(`Check off the remaining ${open} checklist item${open === 1 ? '' : 's'}.`);
  return {
    canComplete: project.status === 'ONGOING' && missing.length === 0,
    completeMissing: missing,
    liquidationCount: files,
    checklistDone: items.length - open,
    checklistTotal: items.length,
  };
}

const withInfo = (project) => ({
  ...project,
  ...completionInfo(project),
  ...canvassInfo(project),
  ...liquidationTotals(project),
});

// The SK side (admin, chairman, officials) sees everything; the public never sees
// proposals or rejected projects, and never the liquidation files.
function canSeeProposed(user) {
  return isStaff(user);
}

function stripInternal(project) {
  const { deletionRequests, liquidationFiles, quotations, winningQuotationId, amountSpent, amountToRefund, receiptsWithoutAmount, receiptReading, ...rest } = project;
  return rest;
}

// GET /api/projects — public.
//   ?archive=completed|cancelled|onhold|deleted (SK side) lists one tab of Archives;
//   ?archive=all (SK side) lists every project that is not deleted (the Dashboard);
//   otherwise the active projects (Proposed, Planning, Ongoing, On Hold). The public list also
//   shows completed projects, as before.
async function getProjects(req, res, next) {
  try {
    const { status, category, archive } = req.query;
    const staff = canSeeProposed(req.user);
    const where = { archivedAt: null };
    if (category) where.category = category;
    if (staff && archive === 'deleted') where.archivedAt = { not: null };
    else if (staff && archive === 'completed') where.status = 'COMPLETED';
    else if (staff && archive === 'cancelled') where.status = 'CANCELLED';
    else if (staff && archive === 'onhold') {
      where.status = 'ON_HOLD';
      where.holdArchivedAt = { not: null };
    }
    else if (staff && archive === 'all') {
      // every stage
    } else if (staff) {
      where.status = { in: ['PROPOSED', 'PLANNING', 'ONGOING', 'ON_HOLD'] };
      where.holdArchivedAt = null;
    }
    else {
      where.status = { in: ['PLANNING', 'ONGOING', 'COMPLETED'] };
      where.approvalState = 'APPROVED';
    }
    if (status) where.status = status;

    const projects = await prisma.project.findMany({
      where,
      orderBy: archive ? { updatedAt: 'desc' } : { createdAt: 'desc' },
      include: includeOpts,
    });
    let result = projects.map(withInfo);
    if (!staff) result = result.map(stripInternal);
    res.json({ projects: result });
  } catch (err) {
    next(err);
  }
}

// GET /api/projects/:id — public.
async function getProject(req, res, next) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: includeOpts,
    });
    const hiddenFromPublic =
      project &&
      (project.status === 'PROPOSED' || project.status === 'CANCELLED' || project.archivedAt || project.holdArchivedAt);
    if (!project || (hiddenFromPublic && !canSeeProposed(req.user))) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const result = withInfo(project);
    // Progress photos shown on the public project page
    result.photos = await photosForProject(project.id);
    res.json({ project: canSeeProposed(req.user) ? result : stripInternal(result) });
  } catch (err) {
    next(err);
  }
}

// Turns the form's purchase request rows into rows ready to save. Blank rows are
// dropped; amounts must be numbers that are not negative. Returns null when the
// body sent no rows at all (so an update leaves the saved rows alone).
// Today's date in the Philippines, as YYYY-MM-DD.
const phToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

// keepDates: the PR dates the project already has (editing keeps them even if past).
function cleanRequestItems(raw, keepDates = new Set()) {
  if (!Array.isArray(raw)) return null;
  const items = [];
  const today = phToday();
  for (const row of raw) {
    const prNo = String(row?.prNo ?? '').trim();
    const requestedBy = String(row?.requestedBy ?? '').trim();
    const amount = Number(row?.amount || 0);
    const prDate = row?.prDate ? new Date(row.prDate) : null;
    if (!prNo && !requestedBy && !amount && !prDate) continue;
    if (!Number.isFinite(amount) || amount < 0) {
      const err = new Error('Each amount must be a number that is not negative');
      err.status = 400;
      throw err;
    }
    // The date of a PR can be today or later, not in the past.
    const day = row?.prDate ? String(row.prDate).slice(0, 10) : '';
    if (day && day < today && !keepDates.has(day)) {
      const err = new Error('The date of PR cannot be in the past');
      err.status = 400;
      throw err;
    }
    items.push({
      prNo: prNo || null,
      requestedBy: requestedBy || null,
      amount,
      prDate: prDate && !Number.isNaN(prDate.getTime()) ? prDate : null,
      displayOrder: items.length,
    });
  }
  return items;
}

// The items to buy (description, unit, quantity, estimated unit cost). Blank rows are dropped.
// Returns null when the body sent no items (so an update leaves the saved ones alone).
// Rows that came from the database keep their id, so the quotations' prices stay attached.
function cleanItems(raw) {
  if (!Array.isArray(raw)) return null;
  const items = [];
  for (const row of raw) {
    const description = String(row?.description ?? '').trim().slice(0, 300);
    const unit = String(row?.unit ?? '').trim().slice(0, 40);
    const quantity = Number(row?.quantity || 0);
    const estUnitCost = Number(row?.estUnitCost || 0);
    if (!description && !unit && !quantity && !estUnitCost) continue;
    if (!description) throw Object.assign(new Error('Each item needs a description'), { status: 400 });
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw Object.assign(new Error('Each item quantity must be a whole number of at least 1'), { status: 400 });
    }
    if (!Number.isFinite(estUnitCost) || estUnitCost < 0) {
      throw Object.assign(new Error('Each unit cost must be a number that is not negative'), { status: 400 });
    }
    items.push({
      id: typeof row?.id === 'string' && row.id ? row.id : null,
      description,
      unit: unit || null,
      quantity,
      estUnitCost: round2(estUnitCost),
      displayOrder: items.length,
    });
  }
  return items;
}

// Normalize the Project Request form into Prisma-ready data + team ids. The status and
// the schedule are not accepted here: they only change through the flow's own steps.
function parseProjectBody(body, keepDates) {
  const { title, description, category, budget, location, coverImageUrl, officialIds, proposedByName, proposedByPosition } = body;

  const data = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (category !== undefined) data.category = category;
  if (budget !== undefined) data.budget = budget;
  if (location !== undefined) data.location = location;
  if (coverImageUrl !== undefined) data.coverImageUrl = coverImageUrl;
  // "Prepared by" on the request form; blank clears it.
  if (proposedByName !== undefined) data.proposedByName = proposedByName || null;
  if (proposedByPosition !== undefined) data.proposedByPosition = proposedByPosition || null;

  // The budget is the total of the purchase request amounts, when any are given.
  const requestItems = cleanRequestItems(body.requestItems, keepDates);
  if (requestItems) {
    const total = requestItems.reduce((sum, i) => sum + i.amount, 0);
    if (total > 0) data.budget = total;
  }

  return { data, officialIds, requestItems, items: cleanItems(body.items) };
}

// Loads a project for a change and refuses archived or closed ones.
// Returns { project } or { error: [status, message] }.
async function loadOpen(id) {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return { error: [404, 'Project not found'] };
  if (project.archivedAt) return { error: [400, ARCHIVED_MESSAGE] };
  if (project.status === 'COMPLETED' || project.status === 'CANCELLED' || project.holdArchivedAt) {
    return { error: [400, CLOSED_MESSAGE] };
  }
  return { project };
}

// Like loadOpen, and the project must be at the given stage.
async function loadAtStage(id, stage, action) {
  const r = await loadOpen(id);
  if (r.error) return r;
  if (r.project.status !== stage) {
    return { error: [400, `${action} is only possible while the project is ${STAGE_NAME[stage]}`] };
  }
  return r;
}

const fail = (res, [code, message]) => res.status(code).json({ message });
const STAGE_NAME = { PROPOSED: 'Proposed', PLANNING: 'Planning', ONGOING: 'Ongoing', ON_HOLD: 'On Hold' };

// POST /api/projects — admin. The Project Request: saved as Proposed, waiting for the
// Barangay Chairman.
async function createProject(req, res, next) {
  try {
    if (!req.body.title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    const { data, officialIds, requestItems, items } = parseProjectBody(req.body);
    if (requestItems && requestItems.length > 0) {
      data.requestItems = { create: requestItems };
    }
    if (items && items.length > 0) {
      data.items = { create: items.map(({ id, ...item }) => item) };
    }
    data.status = 'PROPOSED';
    data.approvalState = 'PENDING';
    data.createdById = req.user.id;
    if (Array.isArray(officialIds)) {
      data.officials = { connect: officialIds.map((id) => ({ id })) };
    }

    const project = await prisma.project.create({ data, include: includeOpts });
    res.status(201).json({ project: withInfo(project) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/projects/:id — admin. Edits the request details (not the stage or schedule).
async function updateProject(req, res, next) {
  try {
    const r = await loadOpen(req.params.id);
    if (r.error) return fail(res, r.error);

    // PR dates already saved on the project stay valid when it is edited.
    const saved = await prisma.projectRequestItem.findMany({
      where: { projectId: req.params.id, prDate: { not: null } },
      select: { prDate: true },
    });
    const keepDates = new Set(saved.map((i) => i.prDate.toISOString().slice(0, 10)));
    const { data, officialIds, requestItems, items } = parseProjectBody(req.body, keepDates);
    if (requestItems) {
      // The sheet is saved as a whole: replace all rows with the ones sent.
      data.requestItems = { deleteMany: {}, create: requestItems };
    }
    if (items) {
      // Items keep their ids (the quotations' prices point at them); removed ones are deleted.
      const saved = await prisma.projectItem.findMany({ where: { projectId: req.params.id }, select: { id: true } });
      const savedIds = new Set(saved.map((i) => i.id));
      const kept = items.filter((i) => i.id && savedIds.has(i.id));
      data.items = {
        deleteMany: { id: { notIn: kept.map((i) => i.id) } },
        update: kept.map(({ id, ...item }) => ({ where: { id }, data: item })),
        create: items.filter((i) => !(i.id && savedIds.has(i.id))).map(({ id, ...item }) => item),
      };
    }
    if (Array.isArray(officialIds)) {
      // "set" replaces the whole team with the provided ids.
      data.officials = { set: officialIds.map((id) => ({ id })) };
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data,
      include: includeOpts,
    });
    res.json({ project: withInfo(project) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/projects/:id/review — Barangay Chairman. { decision: APPROVE | REJECT, remarks? }
//   APPROVE -> Planning; REJECT -> Cancelled (it moves to Archives under Cancelled).
async function reviewProject(req, res, next) {
  try {
    const r = await loadAtStage(req.params.id, 'PROPOSED', 'Approving or rejecting');
    if (r.error) return fail(res, r.error);
    const { decision } = req.body;
    if (decision !== 'APPROVE' && decision !== 'REJECT') {
      return res.status(400).json({ message: 'Decision must be APPROVE or REJECT' });
    }
    const remarks = (req.body.remarks || '').trim();
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        status: decision === 'APPROVE' ? 'PLANNING' : 'CANCELLED',
        approvalState: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        reviewRemarks: remarks || null,
      },
      include: includeOpts,
    });
    res.json({ project: withInfo(project) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/projects/:id/schedule — SK Admin. { startDate, endDate } (date and time).
// Saving the schedule of a Planning project makes it Ongoing.
async function setSchedule(req, res, next) {
  try {
    const r = await loadAtStage(req.params.id, 'PLANNING', 'Setting the schedule');
    if (r.error) return fail(res, r.error);
    const start = req.body.startDate ? parsePhDate(req.body.startDate) : null;
    const end = req.body.endDate ? parsePhDate(req.body.endDate) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Enter the start and the end date and time' });
    }
    // The start can be now or later (a minute of leeway for the time it takes to send).
    if (start.getTime() < Date.now() - 60 * 1000) {
      return res.status(400).json({ message: 'The start date and time cannot be in the past' });
    }
    if (end <= start) {
      return res.status(400).json({ message: 'The end date and time must be later than the start' });
    }
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { startDate: start, endDate: end, status: 'ONGOING' },
      include: includeOpts,
    });
    res.json({ project: withInfo(project) });
  } catch (err) {
    next(err);
  }
}

// ---------- Supplier quotations (canvass), Planning and Ongoing ----------

const CANVASS_STAGES = ['PLANNING', 'ONGOING'];

// Reads { supplierName, supplierAddress?, prices: { itemId: unitPrice } } against the project's items.
async function parseQuotation(projectId, body) {
  const supplierName = String(body?.supplierName || '').trim().slice(0, 150);
  if (!supplierName) throw Object.assign(new Error("Enter the supplier's name"), { status: 400 });
  const items = await prisma.projectItem.findMany({ where: { projectId }, select: { id: true } });
  if (items.length === 0) {
    throw Object.assign(new Error('Add the items to buy (Edit the project) before entering quotations'), { status: 400 });
  }
  const prices = {};
  const sent = body?.prices && typeof body.prices === 'object' ? body.prices : {};
  for (const { id } of items) {
    const raw = sent[id];
    if (raw === undefined || raw === null || raw === '') continue;
    const price = Number(raw);
    if (!Number.isFinite(price) || price < 0) {
      throw Object.assign(new Error('Each price must be a number that is not negative'), { status: 400 });
    }
    prices[id] = round2(price);
  }
  return {
    supplierName,
    supplierAddress: String(body?.supplierAddress || '').trim().slice(0, 200) || null,
    prices,
  };
}

async function loadForCanvass(id) {
  const r = await loadOpen(id);
  if (r.error) return r;
  if (!CANVASS_STAGES.includes(r.project.status)) {
    return { error: [400, 'Quotations are entered once the project is approved (Planning or Ongoing)'] };
  }
  return r;
}

// POST /api/projects/:id/quotations — SK Admin.
async function addQuotation(req, res, next) {
  try {
    const r = await loadForCanvass(req.params.id);
    if (r.error) return fail(res, r.error);
    const data = await parseQuotation(req.params.id, req.body);
    await prisma.projectQuotation.create({ data: { ...data, projectId: req.params.id } });
    res.status(201).json({ project: await projectWithInfo(req.params.id) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/projects/:id/quotations/:qid — SK Admin.
async function updateQuotation(req, res, next) {
  try {
    const r = await loadForCanvass(req.params.id);
    if (r.error) return fail(res, r.error);
    const q = await prisma.projectQuotation.findUnique({ where: { id: req.params.qid } });
    if (!q || q.projectId !== req.params.id) return res.status(404).json({ message: 'Quotation not found' });
    const data = await parseQuotation(req.params.id, req.body);
    await prisma.projectQuotation.update({ where: { id: q.id }, data });
    res.json({ project: await projectWithInfo(req.params.id) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/projects/:id/quotations/:qid — SK Admin.
async function deleteQuotation(req, res, next) {
  try {
    const r = await loadForCanvass(req.params.id);
    if (r.error) return fail(res, r.error);
    const q = await prisma.projectQuotation.findUnique({ where: { id: req.params.qid } });
    if (!q || q.projectId !== req.params.id) return res.status(404).json({ message: 'Quotation not found' });
    await prisma.projectQuotation.delete({ where: { id: q.id } });
    res.json({ project: await projectWithInfo(req.params.id) });
  } catch (err) {
    next(err);
  }
}

// ---------- Receipt liquidation (Ongoing) ----------

// Reads new receipts one at a time in the background and saves what each says. A receipt that
// cannot be read is marked FAILED for the SK Admin to type; nothing here fails the upload.
async function readReceiptsLater(files) {
  for (const f of files) {
    let fields;
    try {
      fields = toReceiptFields(await readReceipt(receiptPath(f.fileName), f.mimeType));
    } catch (err) {
      console.error('Receipt reading failed:', err.message);
      fields = { readStatus: 'FAILED' };
    }
    // Skip it if the file was deleted, or the SK Admin typed the amount, while it was being read.
    await prisma.liquidationFile.updateMany({ where: { id: f.id, readStatus: 'PENDING' }, data: fields }).catch(() => {});
  }
}

// POST /api/projects/:id/liquidation — SK Admin. multipart "files" (JPG, PNG or PDF, many).
// When receipt reading is set up, each receipt is read by Claude after the upload (PENDING
// until then); otherwise the SK Admin types the amounts.
async function addLiquidation(req, res, next) {
  const files = req.files || [];
  const discard = () => files.forEach((f) => removeReceiptFile(f.filename));
  try {
    const r = await loadAtStage(req.params.id, 'ONGOING', 'Uploading the liquidation');
    if (r.error) {
      discard();
      return fail(res, r.error);
    }
    if (files.length === 0) return res.status(400).json({ message: 'Choose at least one file to upload' });
    const reading = isReaderConfigured();
    const rows = files.map((f) => ({
      id: crypto.randomUUID(),
      projectId: req.params.id,
      fileName: f.filename,
      originalName: f.originalname,
      mimeType: f.mimetype,
      uploadedById: req.user.id,
      uploadedByName: req.user.name,
      readStatus: reading ? 'PENDING' : null,
    }));
    await prisma.liquidationFile.createMany({ data: rows });
    if (reading) readReceiptsLater(rows).catch((err) => console.error('Receipt reading failed:', err.message));
    const project = await prisma.project.findUnique({ where: { id: req.params.id }, include: includeOpts });
    res.status(201).json({ project: withInfo(project) });
  } catch (err) {
    discard();
    next(err);
  }
}

// GET /api/projects/:id/liquidation/:fileId — SK side (also from Archives).
async function getLiquidationFile(req, res, next) {
  try {
    const file = await prisma.liquidationFile.findUnique({ where: { id: req.params.fileId } });
    if (!file || file.projectId !== req.params.id) {
      return res.status(404).json({ message: 'File not found' });
    }
    res.type(file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.originalName || 'liquidation')}`);
    res.sendFile(receiptPath(file.fileName), (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'The file is missing' });
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/projects/:id/liquidation/:fileId — SK Admin, while Ongoing. { amount, receiptDate?, storeName? }
// Types or corrects what a receipt says.
async function updateLiquidationFile(req, res, next) {
  try {
    const r = await loadAtStage(req.params.id, 'ONGOING', 'Changing a receipt');
    if (r.error) return fail(res, r.error);
    const file = await prisma.liquidationFile.findUnique({ where: { id: req.params.fileId } });
    if (!file || file.projectId !== req.params.id) {
      return res.status(404).json({ message: 'File not found' });
    }
    const amount = Number(req.body?.amount);
    if (req.body?.amount === '' || req.body?.amount == null || !Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ message: 'Enter the receipt amount as a number that is not negative' });
    }
    let receiptDate = null;
    if (req.body?.receiptDate) {
      receiptDate = new Date(`${String(req.body.receiptDate).slice(0, 10)}T00:00:00+08:00`);
      if (Number.isNaN(receiptDate.getTime())) return res.status(400).json({ message: 'Enter a valid receipt date' });
    }
    await prisma.liquidationFile.update({
      where: { id: file.id },
      data: {
        amount: round2(amount),
        receiptDate,
        storeName: String(req.body?.storeName || '').trim().slice(0, 120) || null,
        readStatus: 'MANUAL',
      },
    });
    const project = await prisma.project.findUnique({ where: { id: req.params.id }, include: includeOpts });
    res.json({ project: withInfo(project) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/projects/:id/liquidation/:fileId — SK Admin, while Ongoing.
async function deleteLiquidationFile(req, res, next) {
  try {
    const r = await loadAtStage(req.params.id, 'ONGOING', 'Deleting a liquidation file');
    if (r.error) return fail(res, r.error);
    const file = await prisma.liquidationFile.findUnique({ where: { id: req.params.fileId } });
    if (!file || file.projectId !== req.params.id) {
      return res.status(404).json({ message: 'File not found' });
    }
    await prisma.liquidationFile.delete({ where: { id: file.id } });
    // The same stored file can still belong to an old expense record; keep it then.
    const stillUsed = await prisma.expense.count({ where: { receiptFile: file.fileName } });
    if (!stillUsed) removeReceiptFile(file.fileName);
    const project = await prisma.project.findUnique({ where: { id: req.params.id }, include: includeOpts });
    res.json({ project: withInfo(project) });
  } catch (err) {
    next(err);
  }
}

// ---------- Checklist (Ongoing, optional) ----------

async function projectWithInfo(id) {
  const project = await prisma.project.findUnique({ where: { id }, include: includeOpts });
  return withInfo(project);
}

// POST /api/projects/:id/checklist — SK Admin. { label }
async function addChecklistItem(req, res, next) {
  try {
    const r = await loadAtStage(req.params.id, 'ONGOING', 'Changing the checklist');
    if (r.error) return fail(res, r.error);
    const label = String(req.body.label || '').trim();
    if (!label) return res.status(400).json({ message: 'Write the checklist item' });
    const count = await prisma.checklistItem.count({ where: { projectId: req.params.id } });
    await prisma.checklistItem.create({
      data: { projectId: req.params.id, label: label.slice(0, 200), displayOrder: count },
    });
    res.status(201).json({ project: await projectWithInfo(req.params.id) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/projects/:id/checklist/:itemId — SK Admin. { label?, done? }
async function updateChecklistItem(req, res, next) {
  try {
    const r = await loadAtStage(req.params.id, 'ONGOING', 'Changing the checklist');
    if (r.error) return fail(res, r.error);
    const item = await prisma.checklistItem.findUnique({ where: { id: req.params.itemId } });
    if (!item || item.projectId !== req.params.id) {
      return res.status(404).json({ message: 'Checklist item not found' });
    }
    const data = {};
    if (req.body.label !== undefined) {
      const label = String(req.body.label || '').trim();
      if (!label) return res.status(400).json({ message: 'Write the checklist item' });
      data.label = label.slice(0, 200);
    }
    if (req.body.done !== undefined) data.done = Boolean(req.body.done);
    await prisma.checklistItem.update({ where: { id: item.id }, data });
    res.json({ project: await projectWithInfo(req.params.id) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/projects/:id/checklist/:itemId — SK Admin.
async function deleteChecklistItem(req, res, next) {
  try {
    const r = await loadAtStage(req.params.id, 'ONGOING', 'Changing the checklist');
    if (r.error) return fail(res, r.error);
    const item = await prisma.checklistItem.findUnique({ where: { id: req.params.itemId } });
    if (!item || item.projectId !== req.params.id) {
      return res.status(404).json({ message: 'Checklist item not found' });
    }
    await prisma.checklistItem.delete({ where: { id: item.id } });
    res.json({ project: await projectWithInfo(req.params.id) });
  } catch (err) {
    next(err);
  }
}

// POST /api/projects/:id/complete — SK Admin. "Project Completed": needs at least one
// liquidation file and every checklist item (if any) checked. Moves it to Archives.
async function completeProject(req, res, next) {
  try {
    const r = await loadAtStage(req.params.id, 'ONGOING', 'Marking the project as completed');
    if (r.error) return fail(res, r.error);
    const current = await projectWithInfo(req.params.id);
    if (!current.canComplete) {
      return res.status(400).json({ message: `The project cannot be completed yet. ${current.completeMissing.join(' ')}` });
    }
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { status: 'COMPLETED' },
      include: includeOpts,
    });
    res.json({ project: withInfo(project) });
  } catch (err) {
    next(err);
  }
}

// ---------- On Hold ----------

// Moves the project from one stage to another (the given checks already passed).
async function setStage(id, data) {
  const project = await prisma.project.update({ where: { id }, data, include: includeOpts });
  return withInfo(project);
}

// POST /api/projects/:id/hold — SK Admin. Ongoing -> On Hold (paused).
async function holdProject(req, res, next) {
  try {
    const r = await loadAtStage(req.params.id, 'ONGOING', 'Putting the project on hold');
    if (r.error) return fail(res, r.error);
    res.json({ project: await setStage(req.params.id, { status: 'ON_HOLD' }) });
  } catch (err) {
    next(err);
  }
}

// POST /api/projects/:id/resume — SK Admin. On Hold -> Ongoing.
async function resumeProject(req, res, next) {
  try {
    const r = await loadAtStage(req.params.id, 'ON_HOLD', 'Resuming the project');
    if (r.error) return fail(res, r.error);
    res.json({ project: await setStage(req.params.id, { status: 'ONGOING' }) });
  } catch (err) {
    next(err);
  }
}

// POST /api/projects/:id/archive-hold — SK Admin. On Hold -> Archives (On Hold tab), view only.
async function archiveHeldProject(req, res, next) {
  try {
    const r = await loadAtStage(req.params.id, 'ON_HOLD', 'Moving the project to Archives');
    if (r.error) return fail(res, r.error);
    res.json({ project: await setStage(req.params.id, { holdArchivedAt: new Date() }) });
  } catch (err) {
    next(err);
  }
}

// ---------- Deletion requests (the Deleted tab of Archives) ----------

// POST /api/projects/:id/deletion-request — admin.
async function requestDeletion(req, res, next) {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.archivedAt) return res.status(400).json({ message: ARCHIVED_MESSAGE });

    const reason = (req.body.reason || '').trim();
    if (reason.length < MIN_REASON_LENGTH) {
      return res.status(400).json({
        message: `Please give a valid reason (at least ${MIN_REASON_LENGTH} characters)`,
      });
    }

    const pending = await prisma.deletionRequest.findFirst({
      where: { projectId: project.id, status: 'PENDING' },
    });
    if (pending) {
      return res.status(400).json({ message: 'A deletion request is already pending' });
    }

    const request = await prisma.deletionRequest.create({
      data: {
        projectId: project.id,
        projectTitle: project.title,
        reason,
        requestedById: req.user.id,
        requestedByName: req.user.name,
      },
    });
    res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/projects/:id/deletion-request — admin. Withdraw the pending request.
async function withdrawDeletion(req, res, next) {
  try {
    const pending = await prisma.deletionRequest.findFirst({
      where: { projectId: req.params.id, status: 'PENDING' },
    });
    if (!pending) return res.status(404).json({ message: 'No pending deletion request' });

    const request = await prisma.deletionRequest.update({
      where: { id: pending.id },
      data: { status: 'WITHDRAWN' },
    });
    res.json({ request });
  } catch (err) {
    next(err);
  }
}

// GET /api/projects/deletion-requests?status=PENDING — admin and chairman.
async function listDeletionRequests(req, res, next) {
  try {
    const status = req.query.status || 'PENDING';
    const requests = await prisma.deletionRequest.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          select: { id: true, title: true, status: true, budget: true, startDate: true, endDate: true },
        },
      },
    });
    res.json({ requests });
  } catch (err) {
    next(err);
  }
}

// PUT /api/projects/deletion-requests/:requestId/review — chairman.
// APPROVE moves the project to the archive; REJECT keeps it and records the remarks.
async function reviewDeletion(req, res, next) {
  try {
    const request = await prisma.deletionRequest.findUnique({
      where: { id: req.params.requestId },
    });
    if (!request) return res.status(404).json({ message: 'Deletion request not found' });
    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: 'This request has already been decided' });
    }

    const { decision } = req.body;
    const remarks = (req.body.remarks || '').trim();
    if (decision !== 'APPROVE' && decision !== 'REJECT') {
      return res.status(400).json({ message: 'Decision must be APPROVE or REJECT' });
    }
    if (decision === 'REJECT' && !remarks) {
      return res.status(400).json({ message: 'Remarks are required when rejecting a request' });
    }

    const decided = prisma.deletionRequest.update({
      where: { id: request.id },
      data: {
        status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        reviewedById: req.user.id,
        reviewedByName: req.user.name,
        reviewedAt: new Date(),
        reviewRemarks: remarks || null,
      },
    });

    if (decision === 'APPROVE' && request.projectId) {
      // Mark the request and archive the project together; nothing is erased.
      const [updated] = await prisma.$transaction([
        decided,
        prisma.project.update({
          where: { id: request.projectId },
          data: {
            archivedAt: new Date(),
            archivedReason: request.reason,
            archivedByName: req.user.name,
          },
        }),
      ]);
      return res.json({ request: updated, archived: true });
    }

    const updated = await decided;
    res.json({ request: updated, archived: false });
  } catch (err) {
    next(err);
  }
}

// POST /api/projects/:id/restore — chairman. Brings a deleted project back.
async function restoreProject(req, res, next) {
  try {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Project not found' });
    if (!existing.archivedAt) {
      return res.status(400).json({ message: 'This project is not in the archive' });
    }
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { archivedAt: null, archivedReason: null, archivedByName: null },
      include: includeOpts,
    });
    res.json({ project: withInfo(project) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProjects,
  getProject,
  createProject,
  updateProject,
  reviewProject,
  setSchedule,
  addLiquidation,
  getLiquidationFile,
  updateLiquidationFile,
  deleteLiquidationFile,
  addQuotation,
  updateQuotation,
  deleteQuotation,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  completeProject,
  holdProject,
  resumeProject,
  archiveHeldProject,
  requestDeletion,
  withdrawDeletion,
  listDeletionRequests,
  reviewDeletion,
  restoreProject,
  completionInfo,
};
