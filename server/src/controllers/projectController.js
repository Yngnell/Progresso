const prisma = require('../prisma');
const { readReceipt, isReaderConfigured } = require('../utils/receiptReader');
const { receiptPath, removeReceiptFile, uploadedFiles } = require('../middleware/upload');
const { fileBase, combinePdf, sendPdf } = require('../utils/combineFiles');
const { isStaff } = require('../utils/roles');
const { EDITABLE, CLOSED, STATUS_LABEL, assertTransition } = require('../utils/projectStatus');
const { EXPENSE_CATEGORIES, round2, itemRemaining, projectMoney } = require('../utils/projectBudget');

// The SK project process. Status changes only go through assertTransition:
//   Project Request   SK Admin   saved as DRAFT; submitted -> PENDING (FOR_REVISION -> PENDING)
//   Review            Chairman   PENDING -> APPROVED | FOR_REVISION | REJECTED
//   Start             SK Admin   APPROVED -> ONGOING
//   Expense           SK Admin   ONGOING
//   File Upload       SK Admin   any project that is still open
//   Completion        SK Admin   ONGOING -> COMPLETED
//   Cancellation      SK Admin   APPROVED | ONGOING -> CANCELLED
// Money is computed in utils/projectBudget.js only. Rejected, completed and cancelled projects
// are view only (Archives); a project removed through a deletion request is kept as archived.

const ARCHIVED_MESSAGE = 'This project is archived and can no longer be changed';
const MIN_REASON_LENGTH = 10;

const ACTIVE = ['DRAFT', 'PENDING', 'FOR_REVISION', 'APPROVED', 'ONGOING'];
const PUBLIC = ['APPROVED', 'ONGOING', 'COMPLETED'];
// File Upload document types. LIQUIDATION is added by Completion only.
const DOCUMENT_TYPES = {
  SK_RESOLUTION: 'SK Resolution',
  ACTIVITY_DESIGN: 'Activity design',
  PURCHASE_REQUEST: 'Purchase request',
  RECEIPT: 'Receipt',
  PHOTO: 'Photo',
  REPORT: 'Report',
  LIQUIDATION: 'Liquidation',
};
const UPLOAD_TYPES = ['SK_RESOLUTION', 'ACTIVITY_DESIGN', 'PURCHASE_REQUEST', 'RECEIPT', 'PHOTO', 'REPORT'];
// Files can be added or removed while the project is being drafted, after a decision to go
// ahead, and while it runs; not while the Barangay Chairman is reviewing it, and not once closed.
const FILE_OPEN = ['DRAFT', 'FOR_REVISION', 'APPROVED', 'ONGOING'];
const IMAGE_OR_PDF = ['application/pdf', 'image/jpeg', 'image/png'];

const FILE_FIELDS = {
  id: true,
  originalName: true,
  mimeType: true,
  uploadedByName: true,
  createdAt: true,
  amount: true,
  receiptDate: true,
  storeName: true,
  readStatus: true,
  documentType: true,
  description: true,
};

const includeOpts = {
  officials: { orderBy: { displayOrder: 'asc' } },
  createdBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  // Latest deletion request (any status) so the UI can show pending/rejected.
  deletionRequests: { orderBy: { createdAt: 'desc' }, take: 1 },
  abyipItem: { select: { id: true, name: true, year: true, center: true, targetQuarter: true, allottedAmount: true } },
  budgetRows: { orderBy: { displayOrder: 'asc' } },
  reviews: { orderBy: { reviewedAt: 'desc' }, include: { reviewer: { select: { id: true, name: true } } } },
  liquidationFiles: { orderBy: { createdAt: 'asc' }, select: FILE_FIELDS },
  expenses: {
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      item: true,
      category: true,
      supplier: true,
      amount: true,
      date: true,
      fileId: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  },
};

// Approved cost, spent so far (Expense expenses) and what is left of it.
function withInfo(project) {
  const spent = round2((project.expenses || []).reduce((sum, e) => sum + Number(e.amount), 0));
  const approvedCost = round2(project.estimatedCost);
  return {
    ...project,
    statusLabel: STATUS_LABEL[project.status] || project.status,
    approvedCost,
    amountSpent: spent,
    remainingBudget: round2(approvedCost - spent),
  };
}

// The public never sees drafts, requests under review, rejected or cancelled projects, nor any
// money records, files or review remarks.
function stripInternal(project) {
  const {
    deletionRequests, liquidationFiles, expenses, reviews, amountSpent, remainingBudget,
    reviewRemarks, reviewedBy, cancelReason, budgetRows, ...rest
  } = project;
  return rest;
}

// Which projects the person may see. The Barangay Chairman never sees the SK Admin's drafts.
function visibleWhere(user) {
  if (!isStaff(user)) return { status: { in: PUBLIC }, archivedAt: null };
  if (user.role === 'CHAIRMAN') return { status: { not: 'DRAFT' } };
  return {};
}

const invalid = (res, errors, extra = {}) =>
  res.status(400).json({ message: Object.values(errors)[0], errors, ...extra });
const peso = (n) =>
  `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Dates are entered as days (YYYY-MM-DD) and kept as the start of that day in the Philippines.
const phToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
function phDay(value) {
  const s = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
const dayOf = (date) => new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const text = (v, max) => String(v ?? '').trim().slice(0, max);

async function loadProject(id) {
  return prisma.project.findUnique({ where: { id }, include: includeOpts });
}

// Loads a project for a change: refuses missing (404), archived and wrong-status (400) ones.
// statuses: the statuses the action is allowed in.
async function loadFor(req, res, statuses, action) {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return null;
  }
  if (project.archivedAt) {
    res.status(400).json({ message: ARCHIVED_MESSAGE });
    return null;
  }
  if (statuses && !statuses.includes(project.status)) {
    const allowed = statuses.map((s) => STATUS_LABEL[s]).join(' or ');
    res.status(400).json({ message: `${action} is only possible while the project is ${allowed}` });
    return null;
  }
  return project;
}

// A project for the SK side: the money figures and the ABYIP item's balance available to it
// (Project Request and Review).
async function staffView(project) {
  const result = withInfo(project);
  if (project.abyipItemId) {
    const item = await itemRemaining(project.abyipItemId, { excludeProjectId: project.id });
    result.abyipRemaining = item ? item.remaining : null;
  }
  return result;
}

async function sendProject(res, id, code = 200, extra = {}) {
  res.status(code).json({ project: await staffView(await loadProject(id)), ...extra });
}

// ---------- Lists and details ----------

// GET /api/projects
//   SK side: ?archive=completed|rejected|cancelled|deleted lists one tab of Archives; ?archive=all
//   lists every project that is not deleted (Dashboard); otherwise the active projects. ?status=A,B
//   narrows the list. The public sees approved, ongoing and completed projects.
async function getProjects(req, res, next) {
  try {
    const { category, archive } = req.query;
    const staff = isStaff(req.user);
    const where = { archivedAt: null, ...visibleWhere(req.user) };
    if (category) where.category = category;
    if (staff) {
      if (archive === 'deleted') where.archivedAt = { not: null };
      else if (archive === 'completed') where.status = 'COMPLETED';
      else if (archive === 'rejected') where.status = 'REJECTED';
      else if (archive === 'cancelled') where.status = 'CANCELLED';
      else if (archive !== 'all') {
        where.status = { in: ACTIVE.filter((s) => s !== 'DRAFT' || req.user.role !== 'CHAIRMAN') };
      }
    }
    if (req.query.status) {
      const asked = String(req.query.status).split(',').filter((s) => STATUS_LABEL[s]);
      const allowed = staff ? asked.filter((s) => s !== 'DRAFT' || req.user.role !== 'CHAIRMAN') : asked.filter((s) => PUBLIC.includes(s));
      where.status = { in: allowed };
    }
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

// GET /api/projects/:id. The SK side also gets the ABYIP item's balance available to this
// request (Project Request and Review).
async function getProject(req, res, next) {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, ...visibleWhere(req.user) },
      include: includeOpts,
    });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (!isStaff(req.user)) return res.json({ project: stripInternal(withInfo(project)) });
    const result = await staffView(project);
    res.json({
      project: result,
      documentTypes: DOCUMENT_TYPES,
      expenseCategories: EXPENSE_CATEGORIES,
      // Expense offers "Read receipt" only when Claude receipt reading is set up.
      receiptReading: isReaderConfigured(),
    });
  } catch (err) {
    next(err);
  }
}

// ---------- Project Request ----------

// Reads the request form. A draft needs only the title; submitting needs every field (see
// submitErrors). Budget rows: blank rows are dropped; total = quantity x unit cost.
function readRequest(body) {
  const errors = {};
  const data = {};
  data.title = text(body.title, 200);
  if (!data.title) errors.title = 'Enter the project title';
  data.abyipItemId = body.abyipItemId ? String(body.abyipItemId) : null;
  data.description = text(body.description, 5000) || null;
  data.objectives = text(body.objectives, 5000) || null;
  data.location = text(body.location, 200) || null;
  if (body.targetParticipants === '' || body.targetParticipants == null) data.targetParticipants = null;
  else {
    const n = Number(body.targetParticipants);
    if (!Number.isInteger(n) || n < 1 || n > 1000000) errors.targetParticipants = 'Enter a whole number of participants (at least 1)';
    else data.targetParticipants = n;
  }
  for (const key of ['startDate', 'endDate']) {
    if (!body[key]) data[key] = null;
    else {
      data[key] = phDay(body[key]);
      if (!data[key]) errors[key] = 'Enter a valid date';
    }
  }
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    errors.endDate = 'The end date cannot be before the start date';
  }

  const rows = [];
  (Array.isArray(body.rows) ? body.rows : []).forEach((row, i) => {
    const item = text(row?.item, 200);
    const blank = (v) => v === '' || v == null;
    if (!item && blank(row?.quantity) && blank(row?.unitCost)) return;
    const quantity = Number(row?.quantity);
    const unitCost = Number(row?.unitCost);
    if (!item) errors[`rows.${i}.item`] = 'Enter the item';
    if (blank(row?.quantity) || !Number.isFinite(quantity) || quantity <= 0) errors[`rows.${i}.quantity`] = 'Above zero';
    if (blank(row?.unitCost) || !Number.isFinite(unitCost) || unitCost < 0) errors[`rows.${i}.unitCost`] = 'Zero or more';
    rows.push({
      item,
      quantity: round2(quantity),
      unitCost: round2(unitCost),
      total: round2(round2(quantity) * round2(unitCost)),
      displayOrder: rows.length,
    });
  });
  const estimatedCost = round2(rows.reduce((sum, r) => sum + (Number.isFinite(r.total) ? r.total : 0), 0));
  data.estimatedCost = estimatedCost;
  data.budget = estimatedCost; // older screens and reports read "budget"
  return { data, rows, errors };
}

// What a saved request still lacks before it can be submitted (field -> message).
function submitErrors(p) {
  const errors = {};
  if (!p.title) errors.title = 'Enter the project title';
  if (!p.abyipItemId) errors.abyipItemId = 'Choose the ABYIP item that funds this project';
  if (!p.description) errors.description = 'Describe the project';
  if (!p.objectives) errors.objectives = 'Write the objectives';
  if (!p.targetParticipants) errors.targetParticipants = 'Enter the target number of participants';
  if (!p.location) errors.location = 'Enter the venue';
  if (!p.startDate) errors.startDate = 'Enter the start date';
  if (!p.endDate) errors.endDate = 'Enter the end date';
  if (!(p.budgetRows || []).length) errors.rows = 'Add at least one budget breakdown row';
  else if (!(Number(p.estimatedCost) > 0)) errors.rows = 'The estimated cost must be above zero';
  return errors;
}

async function checkItem(itemId, errors) {
  if (itemId && !(await prisma.abyipItem.findUnique({ where: { id: itemId }, select: { id: true } }))) {
    errors.abyipItemId = 'Choose an ABYIP item from the list';
  }
}

// POST /api/projects — SK Admin. Saves a new request as a Draft.
async function createProject(req, res, next) {
  try {
    const { data, rows, errors } = readRequest(req.body);
    await checkItem(data.abyipItemId, errors);
    if (Object.keys(errors).length) return invalid(res, errors);
    const project = await prisma.project.create({
      data: {
        ...data,
        status: 'DRAFT',
        approvalState: 'PENDING',
        createdById: req.user.id,
        proposedByName: req.user.name,
        proposedByPosition: req.user.position || 'SK Admin',
        budgetRows: { create: rows },
      },
    });
    await sendProject(res, project.id, 201);
  } catch (err) {
    next(err);
  }
}

// PUT /api/projects/:id — SK Admin. Only a Draft or a request returned for revision changes.
async function updateProject(req, res, next) {
  try {
    const project = await loadFor(req, res, EDITABLE, 'Editing the request');
    if (!project) return;
    const { data, rows, errors } = readRequest(req.body);
    await checkItem(data.abyipItemId, errors);
    if (Object.keys(errors).length) return invalid(res, errors);
    await prisma.project.update({
      where: { id: project.id },
      data: { ...data, budgetRows: { deleteMany: {}, create: rows } },
    });
    await sendProject(res, project.id);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/projects/:id/submit — SK Admin. Draft or For Revision -> Pending. Every field is
// required and the estimated cost must fit the ABYIP item's remaining balance.
async function submitProject(req, res, next) {
  try {
    const project = await loadFor(req, res, EDITABLE, 'Submitting the request');
    if (!project) return;
    const full = await loadProject(project.id);
    const errors = submitErrors(full);
    if (Object.keys(errors).length) return invalid(res, errors);
    const item = await itemRemaining(full.abyipItemId, { excludeProjectId: full.id });
    const cost = round2(full.estimatedCost);
    if (cost > item.remaining) {
      const shortage = round2(cost - item.remaining);
      return invalid(
        res,
        { estimatedCost: `The estimated cost is ${peso(shortage)} more than the remaining balance of “${item.name}” (${peso(item.remaining)}).` },
        { shortage, remaining: item.remaining }
      );
    }
    assertTransition(full.status, 'PENDING');
    await prisma.project.update({
      where: { id: full.id },
      data: { status: 'PENDING', approvalState: 'PENDING', submittedAt: new Date() },
    });
    await sendProject(res, full.id);
  } catch (err) {
    next(err);
  }
}

// ---------- Review (Barangay Chairman) ----------

const DECISIONS = {
  APPROVE: { status: 'APPROVED', approvalState: 'APPROVED' },
  RETURN: { status: 'FOR_REVISION', approvalState: 'RETURNED' },
  REJECT: { status: 'REJECTED', approvalState: 'REJECTED' },
};

// PATCH /api/projects/:id/review — Barangay Chairman. { decision: APPROVE | RETURN | REJECT, remarks }
// Remarks are required to return or reject. Approving reserves the estimated cost (the balance
// is checked again, as other requests may have been approved since it was submitted). Every
// decision is kept in the review history.
async function reviewProject(req, res, next) {
  try {
    const project = await loadFor(req, res, ['PENDING'], 'Reviewing the request');
    if (!project) return;
    const decision = DECISIONS[req.body.decision];
    const remarks = text(req.body.remarks, 2000);
    const errors = {};
    if (!decision) errors.decision = 'Choose Approve, Return for Revision or Reject';
    else if (req.body.decision !== 'APPROVE' && !remarks) {
      errors.remarks = `Write the remarks: the SK Admin needs to know why it is ${req.body.decision === 'RETURN' ? 'returned' : 'rejected'}`;
    }
    if (Object.keys(errors).length) return invalid(res, errors);
    if (req.body.decision === 'APPROVE') {
      const item = project.abyipItemId && (await itemRemaining(project.abyipItemId, { excludeProjectId: project.id }));
      const cost = round2(project.estimatedCost);
      if (!item || cost > item.remaining) {
        const left = item ? item.remaining : 0;
        return invalid(res, {
          decision: `The ABYIP item now has only ${peso(left)} left, ${peso(cost - left)} short of the estimated cost. Return it for revision instead.`,
        });
      }
    }
    assertTransition(project.status, decision.status);
    const now = new Date();
    await prisma.$transaction([
      prisma.projectReview.create({
        data: { projectId: project.id, decision: req.body.decision, remarks: remarks || null, reviewerId: req.user.id, reviewedAt: now },
      }),
      prisma.project.update({
        where: { id: project.id },
        data: {
          status: decision.status,
          approvalState: decision.approvalState,
          reviewedById: req.user.id,
          reviewedAt: now,
          reviewRemarks: remarks || null,
          ...(req.body.decision === 'APPROVE' ? { approvedAt: now } : {}),
        },
      }),
    ]);
    await sendProject(res, project.id);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/projects/:id/start — SK Admin. Approved -> Ongoing.
async function startProject(req, res, next) {
  try {
    const project = await loadFor(req, res, ['APPROVED'], 'Starting the project');
    if (!project) return;
    assertTransition(project.status, 'ONGOING');
    await prisma.project.update({ where: { id: project.id }, data: { status: 'ONGOING', startedAt: new Date() } });
    await sendProject(res, project.id);
  } catch (err) {
    next(err);
  }
}

// ---------- Expense (Ongoing) ----------

// POST /api/projects/receipt-read — SK Admin. multipart "file" (a receipt: PDF, JPG or PNG).
// Claude reads the total, date, store and category to prefill Expense; nothing is saved and the file is removed.
async function readReceiptFile(req, res, next) {
  const files = uploadedFiles(req);
  try {
    const file = req.files?.file?.[0];
    if (!file) return res.status(400).json({ message: 'Choose the receipt to read' });
    if (!IMAGE_OR_PDF.includes(file.mimetype)) return res.status(400).json({ message: 'A receipt must be a PDF, JPG or PNG' });
    if (!isReaderConfigured()) return res.status(400).json({ message: 'Receipt reading is not set up. Type the amount instead.' });
    const r = await readReceipt(receiptPath(file.filename), file.mimetype);
    res.json({
      readable: Boolean(r?.readable),
      total: r?.total ?? null,
      date: r?.date ?? null,
      storeName: r?.storeName ?? null,
      category: EXPENSE_CATEGORIES.includes(r?.category) ? r.category : null,
    });
  } catch (err) {
    console.error('Receipt reading failed:', err.message);
    res.json({ readable: false, total: null, date: null, storeName: null, category: null });
  } finally {
    files.forEach((f) => removeReceiptFile(f.filename));
  }
}

// POST /api/projects/:id/expenses — SK Admin. multipart: the receipt ("receipt", required),
// amount, date, and an optional supplier and category (detected when the receipt is read). The amount cannot exceed what is left of the approved
// cost; the receipt is kept in the project files and names the expense.
async function addExpense(req, res, next) {
  const files = uploadedFiles(req);
  const discard = () => files.forEach((f) => removeReceiptFile(f.filename));
  try {
    const project = await loadFor(req, res, ['ONGOING'], 'Recording an expense');
    if (!project) return discard();
    const errors = {};
    const supplier = text(req.body.supplier, 120) || null;
    const category = req.body.category ? String(req.body.category) : null;
    if (category && !EXPENSE_CATEGORIES.includes(category)) errors.category = 'Choose a category from the list';
    const amount = Number(req.body.amount);
    if (req.body.amount === '' || req.body.amount == null || !Number.isFinite(amount) || amount <= 0) {
      errors.amount = 'The amount must be above zero';
    }
    const date = phDay(req.body.date);
    if (!date) errors.date = 'Enter the date';
    else if (String(req.body.date).slice(0, 10) > phToday()) errors.date = 'The date cannot be in the future';
    const receipt = req.files?.receipt?.[0];
    if (!receipt) errors.receipt = 'Upload the receipt';
    else if (!IMAGE_OR_PDF.includes(receipt.mimetype)) errors.receipt = 'A receipt must be a PDF, JPG or PNG';
    if (!errors.amount) {
      const money = await projectMoney(project);
      if (round2(amount) > money.remaining) {
        errors.amount = `Only ${peso(money.remaining)} of the approved cost is left; this is ${peso(round2(amount) - money.remaining)} over.`;
      }
    }
    if (Object.keys(errors).length) {
      discard();
      return invalid(res, errors);
    }
    const item = text(receipt.originalname, 200) || 'Receipt';
    await prisma.$transaction(async (tx) => {
      const file = await tx.liquidationFile.create({
        data: {
          projectId: project.id,
          fileName: receipt.filename,
          originalName: receipt.originalname,
          mimeType: receipt.mimetype,
          uploadedById: req.user.id,
          uploadedByName: req.user.name,
          amount: round2(amount),
          receiptDate: date,
          storeName: supplier,
          readStatus: 'MANUAL',
          documentType: 'RECEIPT',
        },
      });
      await tx.expense.create({
        data: {
          projectId: project.id,
          item,
          category,
          supplier,
          amount: round2(amount),
          date,
          fileId: file.id,
          createdById: req.user.id,
        },
      });
    });
    await sendProject(res, project.id, 201);
  } catch (err) {
    discard();
    next(err);
  }
}

// DELETE /api/projects/:id/expenses/:expenseId — SK Admin, while Ongoing (a wrong entry).
// The receipt stays in the project files.
async function deleteExpense(req, res, next) {
  try {
    const project = await loadFor(req, res, ['ONGOING'], 'Removing an expense');
    if (!project) return;
    const expense = await prisma.expense.findUnique({ where: { id: req.params.expenseId } });
    if (!expense || expense.projectId !== project.id) return res.status(404).json({ message: 'Expense not found' });
    await prisma.expense.delete({ where: { id: expense.id } });
    await sendProject(res, project.id);
  } catch (err) {
    next(err);
  }
}

// ---------- File Upload ----------

// POST /api/projects/:id/files — SK Admin. multipart: "file" (PDF, DOCX, JPG or PNG, up to
// 10 MB) and documentType.
async function addFile(req, res, next) {
  const files = uploadedFiles(req);
  const discard = () => files.forEach((f) => removeReceiptFile(f.filename));
  try {
    const project = await loadFor(req, res, FILE_OPEN, 'Uploading a file');
    if (!project) return discard();
    const errors = {};
    const file = req.files?.file?.[0];
    if (!file) errors.file = 'Choose the file to upload';
    if (!UPLOAD_TYPES.includes(req.body.documentType)) errors.documentType = 'Choose the document type';
    if (Object.keys(errors).length) {
      discard();
      return invalid(res, errors);
    }
    await prisma.liquidationFile.create({
      data: {
        projectId: project.id,
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        uploadedById: req.user.id,
        uploadedByName: req.user.name,
        documentType: req.body.documentType,
      },
    });
    await sendProject(res, project.id, 201);
  } catch (err) {
    discard();
    next(err);
  }
}

// DELETE /api/projects/:id/files/:fileId — SK Admin. A receipt that backs an expense stays.
async function deleteFile(req, res, next) {
  try {
    const project = await loadFor(req, res, FILE_OPEN, 'Removing a file');
    if (!project) return;
    const file = await prisma.liquidationFile.findUnique({
      where: { id: req.params.fileId },
      include: { _count: { select: { expenses: true } } },
    });
    if (!file || file.projectId !== project.id) return res.status(404).json({ message: 'File not found' });
    if (file._count.expenses > 0) {
      return res.status(400).json({ message: 'This receipt belongs to a recorded expense, so it is kept.' });
    }
    await prisma.liquidationFile.delete({ where: { id: file.id } });
    const stillUsed = await prisma.expense.count({ where: { receiptFile: file.fileName } });
    if (!stillUsed) removeReceiptFile(file.fileName);
    await sendProject(res, project.id);
  } catch (err) {
    next(err);
  }
}

// GET /api/projects/:id/files/:fileId — SK side (also from Archives). Opens the file.
async function getFile(req, res, next) {
  try {
    const project = await prisma.project.findFirst({ where: { id: req.params.id, ...visibleWhere(req.user) }, select: { id: true } });
    const file = project && (await prisma.liquidationFile.findUnique({ where: { id: req.params.fileId } }));
    if (!file || file.projectId !== req.params.id) return res.status(404).json({ message: 'File not found' });
    res.type(file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.originalName || 'file')}`);
    res.sendFile(receiptPath(file.fileName), (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'The file is missing' });
    });
  } catch (err) {
    next(err);
  }
}

// ---------- Completion (Ongoing) ----------

async function completionNumbers(project) {
  const money = await projectMoney(project);
  const attendance = await prisma.attendanceRecord.count({ where: { projectId: project.id, status: 'PRESENT' } });
  return {
    approvedCost: money.approvedCost,
    actualCost: money.spent,
    unused: round2(money.approvedCost - money.spent),
    attendanceCount: attendance,
  };
}

// GET /api/projects/:id/completion-info — SK side. The automatic values of Completion and the
// participants counted from the attendance linked to the project.
async function getCompletionInfo(req, res, next) {
  try {
    const project = await prisma.project.findFirst({ where: { id: req.params.id, ...visibleWhere(req.user) } });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(await completionNumbers(project));
  } catch (err) {
    next(err);
  }
}

// PATCH /api/projects/:id/complete — SK Admin. multipart: actualEndDate, actualParticipants,
// accomplishmentSummary, "report" and "liquidation" (both required). Ongoing -> Completed; the
// unused part of the approved cost goes back to the ABYIP item (the balance counts the actual cost).
async function completeProject(req, res, next) {
  const files = uploadedFiles(req);
  const discard = () => files.forEach((f) => removeReceiptFile(f.filename));
  try {
    const project = await loadFor(req, res, ['ONGOING'], 'Completing the project');
    if (!project) return discard();
    const errors = {};
    const end = phDay(req.body.actualEndDate);
    const endDay = String(req.body.actualEndDate || '').slice(0, 10);
    if (!end) errors.actualEndDate = 'Enter the actual end date';
    else if (endDay > phToday()) errors.actualEndDate = 'The actual end date cannot be in the future';
    else if (project.startDate && endDay < dayOf(project.startDate)) errors.actualEndDate = 'The actual end date cannot be before the start date';
    const participants = Number(req.body.actualParticipants);
    if (req.body.actualParticipants === '' || req.body.actualParticipants == null || !Number.isInteger(participants) || participants < 0) {
      errors.actualParticipants = 'Enter the number of participants';
    }
    const summary = text(req.body.accomplishmentSummary, 5000);
    if (!summary) errors.accomplishmentSummary = 'Write the accomplishment summary';
    const report = req.files?.report?.[0];
    const liquidation = req.files?.liquidation?.[0];
    if (!report) errors.report = 'Upload the accomplishment report';
    if (!liquidation) errors.liquidation = 'Upload the liquidation report';
    if (Object.keys(errors).length) {
      discard();
      return invalid(res, errors);
    }
    assertTransition(project.status, 'COMPLETED');
    const fileRow = (f, documentType, description) => ({
      projectId: project.id,
      fileName: f.filename,
      originalName: f.originalname,
      mimeType: f.mimetype,
      uploadedById: req.user.id,
      uploadedByName: req.user.name,
      documentType,
      description,
    });
    await prisma.$transaction([
      prisma.liquidationFile.create({ data: fileRow(report, 'REPORT', 'Accomplishment report') }),
      prisma.liquidationFile.create({ data: fileRow(liquidation, 'LIQUIDATION', 'Liquidation report') }),
      prisma.project.update({
        where: { id: project.id },
        data: {
          status: 'COMPLETED',
          actualEndDate: end,
          actualParticipants: participants,
          accomplishmentSummary: summary,
          completedAt: new Date(),
        },
      }),
    ]);
    const numbers = await completionNumbers(project);
    await sendProject(res, project.id, 200, { returned: numbers.unused });
  } catch (err) {
    discard();
    next(err);
  }
}

// ---------- Cancellation (Approved or Ongoing) ----------

// PATCH /api/projects/:id/cancel — SK Admin. { reason, date }. Approved or Ongoing -> Cancelled.
// The unspent part of the reserve goes back to the ABYIP item; expenses and files are kept.
async function cancelProject(req, res, next) {
  try {
    const project = await loadFor(req, res, ['APPROVED', 'ONGOING'], 'Cancelling the project');
    if (!project) return;
    const errors = {};
    const reason = text(req.body.reason, 2000);
    if (reason.length < MIN_REASON_LENGTH) errors.reason = `Give the reason (at least ${MIN_REASON_LENGTH} characters)`;
    const date = phDay(req.body.date);
    if (!date) errors.date = 'Enter the cancellation date';
    else if (String(req.body.date).slice(0, 10) > phToday()) errors.date = 'The date cannot be in the future';
    if (Object.keys(errors).length) return invalid(res, errors);
    assertTransition(project.status, 'CANCELLED');
    const money = await projectMoney(project);
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'CANCELLED', cancelReason: reason, cancelDate: date, cancelledAt: new Date() },
    });
    await sendProject(res, project.id, 200, { returned: money.remaining });
  } catch (err) {
    next(err);
  }
}

// ---------- Downloads (SK side; also for archived and deleted projects, view only) ----------

const NOTHING = 'No files to download.';

// GET /api/projects/:id/download/receipt-liquidation — receipts and the liquidation report, one PDF.
// GET /api/projects/:id/download/purchase-request — the purchase request files, one PDF.
// Word files cannot be joined into a PDF, so they are left out of these downloads.
function downloadCombined(types, section) {
  return async (req, res, next) => {
    try {
      const project = await prisma.project.findFirst({ where: { id: req.params.id, ...visibleWhere(req.user) }, select: { title: true } });
      if (!project) return res.status(404).json({ message: 'Project not found' });
      const files = await prisma.liquidationFile.findMany({
        where: { projectId: req.params.id, documentType: { in: types }, mimeType: { in: IMAGE_OR_PDF } },
        orderBy: { createdAt: 'asc' },
        select: { fileName: true, originalName: true },
      });
      if (files.length === 0) return res.status(404).json({ message: NOTHING });
      const pdf = await combinePdf(files.map((f) => ({ path: receiptPath(f.fileName), originalName: f.originalName })));
      sendPdf(res, pdf, `${fileBase(project.title)}_${section}.pdf`);
    } catch (err) {
      next(err);
    }
  };
}
const downloadLiquidation = downloadCombined(['RECEIPT', 'LIQUIDATION'], 'Receipt_Liquidation');
const downloadPurchaseRequest = downloadCombined(['PURCHASE_REQUEST'], 'Purchase_Request');


// ---------- Deletion requests (the Deleted tab of Archives) ----------

// POST /api/projects/:id/deletion-request — SK Admin.
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

// DELETE /api/projects/:id/deletion-request — SK Admin. Withdraw the pending request.
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

// GET /api/projects/deletion-requests?status=PENDING — SK Admin and Barangay Chairman.
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

// PUT /api/projects/deletion-requests/:requestId/review — Barangay Chairman.
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

// POST /api/projects/:id/restore — Barangay Chairman. Brings a deleted project back.
async function restoreProject(req, res, next) {
  try {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Project not found' });
    if (!existing.archivedAt) {
      return res.status(400).json({ message: 'This project is not in the archive' });
    }
    await prisma.project.update({
      where: { id: req.params.id },
      data: { archivedAt: null, archivedReason: null, archivedByName: null },
    });
    await sendProject(res, req.params.id);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  DOCUMENT_TYPES,
  getProjects,
  getProject,
  createProject,
  updateProject,
  submitProject,
  reviewProject,
  startProject,
  readReceiptFile,
  addExpense,
  deleteExpense,
  addFile,
  deleteFile,
  getFile,
  getCompletionInfo,
  completeProject,
  cancelProject,
  downloadLiquidation,
  downloadPurchaseRequest,
  requestDeletion,
  withdrawDeletion,
  listDeletionRequests,
  reviewDeletion,
  restoreProject,
};
