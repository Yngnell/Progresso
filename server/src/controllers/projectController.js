const prisma = require('../prisma');
const { receiptPath, removeReceiptFile } = require('../middleware/upload');

// Archived projects are kept for the record but cannot be changed.
const ARCHIVED_MESSAGE = 'This project is archived and can no longer be changed';

// Shared include so lists and details always carry expenses, team, creator,
// checklist tasks, and linked events (the last two drive progress).
const includeOpts = {
  expenses: { orderBy: { date: 'desc' } },
  officials: { orderBy: { displayOrder: 'asc' } },
  createdBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  // Latest deletion request (any status) so the UI can show pending/rejected.
  deletionRequests: { orderBy: { createdAt: 'desc' }, take: 1 },
  tasks: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] },
  requestItems: { orderBy: { displayOrder: 'asc' } },
  events: {
    select: { id: true, title: true, startAt: true, endAt: true },
    orderBy: { startAt: 'asc' },
  },
};

// Points below the expected (timeline) % before a project counts as behind.
const BEHIND_TOLERANCE = 10;

// Progress is computed, never typed by admins, and follows how the SK measures it:
// - with linked events (scheduled sessions): sessions held / sessions scheduled
//   (a session counts once its end time passes);
// - otherwise: the timeline, days elapsed / total days from start and end dates.
// Checklist tasks are a to-do aid and do not change the %. Only COMPLETED reaches 100.
function computeProgress(project) {
  const { status, startDate, endDate, updatedAt } = project;
  const events = project.events || [];
  const tasks = project.tasks || [];

  // A cancelled project freezes at the moment it was cancelled.
  const now = status === 'CANCELLED' && updatedAt ? new Date(updatedAt) : new Date();

  const eventsDone = events.filter((e) => new Date(e.endAt || e.startAt) <= now).length;
  const tasksDone = tasks.filter((t) => t.done).length;

  let expected = null;
  if (startDate && endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const span = end - start;
    const ratio = span > 0 ? (now.getTime() - start) / span : now >= end ? 1 : 0;
    expected = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  }

  let progress = 0;
  let source = null;
  if (status === 'COMPLETED') {
    progress = 100;
  } else if (status === 'PROPOSED' || status === 'PLANNING') {
    progress = 0;
  } else if (events.length > 0) {
    progress = Math.min(99, Math.round((eventsDone / events.length) * 100));
    source = 'sessions';
  } else if (expected !== null) {
    progress = Math.min(99, expected);
    source = 'timeline';
  }

  let schedule = null;
  if (status === 'COMPLETED') schedule = 'COMPLETED';
  else if (status === 'ONGOING') {
    // No "overdue" state: a project past its end date stays Ongoing until it is marked
    // completed (or cancelled) by the admin.
    if (expected !== null && progress < expected - BEHIND_TOLERANCE) schedule = 'BEHIND';
    else schedule = 'ON_TRACK';
  }

  return {
    progress,
    progressBreakdown: {
      eventsDone,
      eventsTotal: events.length,
      tasksDone,
      tasksTotal: tasks.length,
      expected,
      source,
      schedule,
    },
  };
}

// Status is never typed in. PROPOSED only changes through the chairman's
// approval, which moves it to PLANNING. A PLANNING project becomes ONGOING by
// itself once its start date arrives. COMPLETED/CANCELLED are set explicitly.
function effectiveStatus({ status, startDate }) {
  if (status === 'PLANNING' && startDate && new Date(startDate) <= new Date()) {
    return 'ONGOING';
  }
  return status;
}

// Admin and chairman see everything; the public never sees unapproved projects.
function canSeeProposed(user) {
  return Boolean(user && (user.role === 'ADMIN' || user.role === 'CHAIRMAN'));
}

function withProgress(project) {
  const resolved = { ...project, status: effectiveStatus(project) };
  return { ...resolved, ...computeProgress(resolved) };
}

// True when the (possibly partial) update would not leave the end after the start.
// Dates carry a time now, so ending at the very moment it starts is not valid either.
function invalidDateRange(data, existing = {}) {
  const start = data.startDate !== undefined ? data.startDate : existing.startDate;
  const end = data.endDate !== undefined ? data.endDate : existing.endDate;
  return Boolean(start && end && new Date(end) <= new Date(start));
}

// Deletion requests (and their reasons) are internal: never sent to the public.
function stripInternal(project) {
  const { deletionRequests, ...rest } = project;
  // Receipts are only for the admin and the chairman; the public sees the expense lines.
  if (rest.expenses) {
    rest.expenses = rest.expenses.map(
      ({ receiptFile, receiptName, receiptType, ...expense }) => expense
    );
  }
  return rest;
}

// GET /api/projects — public. Optional ?status= & ?category= filters.
async function getProjects(req, res, next) {
  try {
    const { status, category, archived } = req.query;
    const where = {};
    if (category) where.category = category;
    // Normal lists leave the archive out; ?archived=true (admin and chairman) shows only it.
    where.archivedAt = archived === 'true' && canSeeProposed(req.user) ? { not: null } : null;
    // The public never sees unapproved or rejected proposals.
    if (!canSeeProposed(req.user)) {
      where.status = { not: 'PROPOSED' };
      where.approvalState = { not: 'REJECTED' };
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: includeOpts,
    });

    // Filter on the effective status (e.g. PLANNING that has started = ONGOING).
    let result = projects.map(withProgress);
    if (status) result = result.filter((p) => p.status === status);
    if (!canSeeProposed(req.user)) result = result.map(stripInternal);
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
      (project.status === 'PROPOSED' ||
        project.approvalState === 'REJECTED' ||
        project.archivedAt);
    if (!project || (hiddenFromPublic && !canSeeProposed(req.user))) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const result = withProgress(project);
    res.json({ project: canSeeProposed(req.user) ? result : stripInternal(result) });
  } catch (err) {
    next(err);
  }
}

// Turns the form's purchase request rows into rows ready to save. Blank rows are
// dropped; amounts must be numbers that are not negative. Returns null when the
// body sent no rows at all (so an update leaves the saved rows alone).
function cleanRequestItems(raw) {
  if (!Array.isArray(raw)) return null;
  const items = [];
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

// Normalize request body into Prisma-ready data + team ids.
// progress and status are intentionally not accepted: progress is computed and
// status only changes through approval / complete / cancel.
function parseProjectBody(body) {
  const {
    title,
    description,
    category,
    budget,
    startDate,
    endDate,
    location,
    coverImageUrl,
    officialIds,
    proposedByName,
    proposedByPosition,
  } = body;

  const data = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (category !== undefined) data.category = category;
  if (budget !== undefined) data.budget = budget;
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
  if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
  if (location !== undefined) data.location = location;
  if (coverImageUrl !== undefined) data.coverImageUrl = coverImageUrl;
  // "Prepared by" on the proposal form; blank clears it.
  if (proposedByName !== undefined) data.proposedByName = proposedByName || null;
  if (proposedByPosition !== undefined) data.proposedByPosition = proposedByPosition || null;

  // The budget is the total of the purchase request amounts, when any are given.
  const requestItems = cleanRequestItems(body.requestItems);
  if (requestItems) {
    const total = requestItems.reduce((sum, i) => sum + i.amount, 0);
    if (total > 0) data.budget = total;
  }

  return { data, officialIds, requestItems };
}

// Every project goes through the SK's four stages; they start as a checklist
// that the admin can edit or remove.
const DEFAULT_STAGES = [
  'Planning',
  'Execution',
  'Documents',
  'Finalizing the project',
];

// POST /api/projects — admin.
async function createProject(req, res, next) {
  try {
    if (!req.body.title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    const { data, officialIds, requestItems } = parseProjectBody(req.body);
    if (requestItems && requestItems.length > 0) {
      data.requestItems = { create: requestItems };
    }
    // A proposal always needs its target implementation timeline.
    if (!data.startDate || !data.endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }
    if (invalidDateRange(data)) {
      return res.status(400).json({ message: 'The end date and time must be after the start' });
    }
    data.createdById = req.user.id;
    data.tasks = {
      create: DEFAULT_STAGES.map((title, i) => ({ title, displayOrder: i })),
    };
    if (Array.isArray(officialIds)) {
      data.officials = { connect: officialIds.map((id) => ({ id })) };
    }

    const project = await prisma.project.create({ data, include: includeOpts });
    res.status(201).json({ project: withProgress(project) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/projects/:id — admin.
async function updateProject(req, res, next) {
  try {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Project not found' });

    if (existing.archivedAt) return res.status(400).json({ message: ARCHIVED_MESSAGE });
    if (existing.approvalState === 'REJECTED') {
      return res.status(400).json({ message: 'A rejected proposal cannot be edited' });
    }

    const { data, officialIds, requestItems } = parseProjectBody(req.body);
    if (requestItems) {
      // The sheet is saved as a whole: replace all rows with the ones sent.
      data.requestItems = { deleteMany: {}, create: requestItems };
    }
    if (data.startDate === null || data.endDate === null) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }
    if (invalidDateRange(data, existing)) {
      return res.status(400).json({ message: 'The end date and time must be after the start' });
    }
    if (Array.isArray(officialIds)) {
      // "set" replaces the whole team with the provided ids.
      data.officials = { set: officialIds.map((id) => ({ id })) };
    }
    // Editing a returned proposal resubmits it for the chairman's review.
    if (existing.status === 'PROPOSED' && existing.approvalState === 'RETURNED') {
      data.approvalState = 'PENDING';
      data.reviewedById = null;
      data.reviewedAt = null;
      data.reviewRemarks = null;
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data,
      include: includeOpts,
    });
    res.json({ project: withProgress(project) });
  } catch (err) {
    next(err);
  }
}

// What each chairman decision does to a proposal.
//   APPROVE -> Planning | RETURN -> stays Proposed, to be revised
//   REJECT  -> closed (Cancelled); the SK proposes a different program instead
const REVIEW_OUTCOMES = {
  APPROVE: { status: 'PLANNING', approvalState: 'APPROVED' },
  RETURN: { status: 'PROPOSED', approvalState: 'RETURNED' },
  REJECT: { status: 'CANCELLED', approvalState: 'REJECTED' },
};

// PUT /api/projects/:id/review — chairman. Approve, return, or reject a proposal.
async function reviewProject(req, res, next) {
  try {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Project not found' });
    if (existing.status !== 'PROPOSED') {
      return res.status(400).json({ message: 'Only proposed projects can be reviewed' });
    }

    const { decision } = req.body;
    const remarks = (req.body.remarks || '').trim();
    const outcome = REVIEW_OUTCOMES[decision];
    if (!outcome) {
      return res.status(400).json({ message: 'Decision must be APPROVE, RETURN or REJECT' });
    }
    if (decision !== 'APPROVE' && !remarks) {
      return res.status(400).json({
        message: `Remarks are required when you ${decision === 'RETURN' ? 'return' : 'reject'} a proposal`,
      });
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        status: outcome.status,
        approvalState: outcome.approvalState,
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        reviewRemarks: remarks || null,
      },
      include: includeOpts,
    });
    res.json({ project: withProgress(project) });
  } catch (err) {
    next(err);
  }
}

// POST /api/projects/:id/complete — admin. Completion is confirmed by SK council
// approval, so the council approval date is required (resolution number optional).
async function completeProject(req, res, next) {
  try {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Project not found' });
    if (existing.archivedAt) return res.status(400).json({ message: ARCHIVED_MESSAGE });
    // PLANNING in the database may already be ONGOING by its start date.
    if (existing.status !== 'PLANNING' && existing.status !== 'ONGOING') {
      return res.status(400).json({
        message: 'Only approved, active projects can be marked as completed',
      });
    }

    const approvedOn = req.body.councilApprovedOn ? new Date(req.body.councilApprovedOn) : null;
    if (!approvedOn || Number.isNaN(approvedOn.getTime())) {
      return res.status(400).json({ message: 'The SK council approval date is required' });
    }
    const resolutionNo = (req.body.councilResolutionNo || '').trim();

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        status: 'COMPLETED',
        councilApprovedOn: approvedOn,
        councilResolutionNo: resolutionNo || null,
      },
      include: includeOpts,
    });
    res.json({ project: withProgress(project) });
  } catch (err) {
    next(err);
  }
}

// POST /api/projects/:id/cancel — admin. Cancelling is the SK council's decision
// and always needs a written reason.
async function cancelProject(req, res, next) {
  try {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Project not found' });
    if (existing.archivedAt) return res.status(400).json({ message: ARCHIVED_MESSAGE });
    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      return res.status(400).json({ message: 'This project is already closed' });
    }
    const reason = (req.body.reason || '').trim();
    if (reason.length < MIN_REASON_LENGTH) {
      return res.status(400).json({
        message: `Please give a valid reason (at least ${MIN_REASON_LENGTH} characters)`,
      });
    }
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED', cancelReason: reason },
      include: includeOpts,
    });
    res.json({ project: withProgress(project) });
  } catch (err) {
    next(err);
  }
}

// GET /api/projects/:id/report — admin and chairman. Everything the printable
// Accomplishment Report needs in one response: the project with its progress,
// the sessions (linked events) with attendance counts, and the signatories.
async function getProjectReport(req, res, next) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        ...includeOpts,
        events: { orderBy: { startAt: 'asc' }, include: { attendance: true } },
      },
    });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.status === 'PROPOSED' || project.approvalState === 'REJECTED') {
      return res.status(400).json({
        message: 'A report is only available for approved projects',
      });
    }

    const now = new Date();
    const sessions = project.events.map((e) => {
      const count = (status) => e.attendance.filter((a) => a.status === status).length;
      return {
        id: e.id,
        title: e.title,
        startAt: e.startAt,
        endAt: e.endAt,
        location: e.location,
        held: new Date(e.endAt || e.startAt) <= now,
        present: count('PRESENT'),
        late: count('LATE'),
        excused: count('EXCUSED'),
        absent: count('ABSENT'),
        total: e.attendance.length,
      };
    });

    // Signature lines come from the officials directory, matched by position.
    const officials = await prisma.official.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
    const byPosition = (word) =>
      officials.find((o) => (o.position || '').toLowerCase().includes(word)) || null;
    const pick = (o) => (o ? { name: o.name, position: o.position } : null);

    // Attendance records are bulky; the report only needs the per-session counts.
    const { events, ...rest } = withProgress(project);
    res.json({
      project: rest,
      sessions,
      signatories: {
        chairperson: pick(byPosition('chairperson')),
        secretary: pick(byPosition('secretary')),
        treasurer: pick(byPosition('treasurer')),
      },
      generatedAt: now,
    });
  } catch (err) {
    next(err);
  }
}

// ---------- Deletion requests and the archive ----------
// Records are never erased. The admin files a deletion request with a reason; when
// the chairman approves it, the project moves to the Archive (read-only, hidden from
// the public and from the normal lists) with all its expenses, receipts, sessions
// and history. The chairman can restore an archived project.

const MIN_REASON_LENGTH = 10;

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

// POST /api/projects/:id/restore — chairman. Brings an archived project back.
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
    res.json({ project: withProgress(project) });
  } catch (err) {
    next(err);
  }
}

// ---------- Expenses (manual budget deductions) with receipts ----------
// Every expense deducts from the project budget and must be backed by an uploaded
// receipt (image or PDF). Receipts are stored on disk and only served to the admin
// and the chairman through getReceipt.

// True when the project is in the archive and therefore read-only.
async function isArchivedProject(projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { archivedAt: true },
  });
  return Boolean(project && project.archivedAt);
}

// POST /api/projects/:id/expenses — admin. multipart: item, amount, date, voucherNo, receipt (file).
async function addExpense(req, res, next) {
  // A rejected request must not leave its uploaded file behind.
  const discardUpload = () => req.file && removeReceiptFile(req.file.filename);
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) {
      discardUpload();
      return res.status(404).json({ message: 'Project not found' });
    }
    if (project.archivedAt) {
      discardUpload();
      return res.status(400).json({ message: ARCHIVED_MESSAGE });
    }

    const { item, amount, date, voucherNo } = req.body;
    const value = Number(amount);
    if (!item || !String(item).trim() || !Number.isFinite(value) || value <= 0) {
      discardUpload();
      return res.status(400).json({ message: 'Item and an amount greater than zero are required' });
    }
    if (!req.file) {
      return res
        .status(400)
        .json({ message: 'Please upload the receipt as proof of this expense' });
    }

    const expense = await prisma.expense.create({
      data: {
        projectId: req.params.id,
        item: String(item).trim(),
        amount: value,
        date: date ? new Date(date) : undefined,
        voucherNo: voucherNo ? String(voucherNo).trim() : null,
        receiptFile: req.file.filename,
        receiptName: req.file.originalname,
        receiptType: req.file.mimetype,
      },
    });
    res.status(201).json({ expense });
  } catch (err) {
    discardUpload();
    next(err);
  }
}

// POST /api/projects/:id/expenses/:expenseId/receipt — admin. Attach or replace the receipt.
async function attachReceipt(req, res, next) {
  const discardUpload = () => req.file && removeReceiptFile(req.file.filename);
  try {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.expenseId } });
    if (!expense || expense.projectId !== req.params.id) {
      discardUpload();
      return res.status(404).json({ message: 'Expense not found' });
    }
    if (await isArchivedProject(req.params.id)) {
      discardUpload();
      return res.status(400).json({ message: ARCHIVED_MESSAGE });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Please choose the receipt file to upload' });
    }

    const updated = await prisma.expense.update({
      where: { id: expense.id },
      data: {
        receiptFile: req.file.filename,
        receiptName: req.file.originalname,
        receiptType: req.file.mimetype,
      },
    });
    removeReceiptFile(expense.receiptFile); // the replaced file
    res.json({ expense: updated });
  } catch (err) {
    discardUpload();
    next(err);
  }
}

// GET /api/projects/:id/expenses/:expenseId/receipt — admin and chairman only.
async function getReceipt(req, res, next) {
  try {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.expenseId } });
    if (!expense || expense.projectId !== req.params.id || !expense.receiptFile) {
      return res.status(404).json({ message: 'No receipt on file for this expense' });
    }
    res.type(expense.receiptType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(expense.receiptName || 'receipt')}`
    );
    res.sendFile(receiptPath(expense.receiptFile), (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'Receipt file is missing' });
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/projects/:id/expenses/:expenseId — admin.
async function deleteExpense(req, res, next) {
  try {
    const existing = await prisma.expense.findUnique({
      where: { id: req.params.expenseId },
    });
    if (!existing) return res.status(404).json({ message: 'Expense not found' });
    if (await isArchivedProject(existing.projectId)) {
      return res.status(400).json({ message: ARCHIVED_MESSAGE });
    }
    await prisma.expense.delete({ where: { id: req.params.expenseId } });
    removeReceiptFile(existing.receiptFile);
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    next(err);
  }
}

// POST /api/projects/:id/tasks — admin. Add a checklist task.
async function addTask(req, res, next) {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.archivedAt) return res.status(400).json({ message: ARCHIVED_MESSAGE });

    const { title, dueDate } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Task title is required' });
    }

    const count = await prisma.projectTask.count({ where: { projectId: req.params.id } });
    const task = await prisma.projectTask.create({
      data: {
        projectId: req.params.id,
        title: title.trim(),
        dueDate: dueDate ? new Date(dueDate) : null,
        displayOrder: count,
      },
    });
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
}

// PUT /api/projects/:id/tasks/:taskId — admin. Tick/untick or rename a task.
async function updateTask(req, res, next) {
  try {
    const existing = await prisma.projectTask.findUnique({
      where: { id: req.params.taskId },
    });
    if (!existing || existing.projectId !== req.params.id) {
      return res.status(404).json({ message: 'Task not found' });
    }
    if (await isArchivedProject(existing.projectId)) {
      return res.status(400).json({ message: ARCHIVED_MESSAGE });
    }

    const { title, dueDate, done } = req.body;
    const data = {};
    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ message: 'Task title is required' });
      data.title = title.trim();
    }
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (done !== undefined) {
      data.done = Boolean(done);
      data.completedAt = data.done ? existing.completedAt || new Date() : null;
    }

    const task = await prisma.projectTask.update({
      where: { id: req.params.taskId },
      data,
    });
    res.json({ task });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/projects/:id/tasks/:taskId — admin.
async function deleteTask(req, res, next) {
  try {
    const existing = await prisma.projectTask.findUnique({
      where: { id: req.params.taskId },
    });
    if (!existing || existing.projectId !== req.params.id) {
      return res.status(404).json({ message: 'Task not found' });
    }
    if (await isArchivedProject(existing.projectId)) {
      return res.status(400).json({ message: ARCHIVED_MESSAGE });
    }
    await prisma.projectTask.delete({ where: { id: req.params.taskId } });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProjects,
  getProject,
  createProject,
  updateProject,
  getProjectReport,
  requestDeletion,
  withdrawDeletion,
  listDeletionRequests,
  reviewDeletion,
  restoreProject,
  reviewProject,
  completeProject,
  cancelProject,
  addExpense,
  attachReceipt,
  getReceipt,
  deleteExpense,
  addTask,
  updateTask,
  deleteTask,
  computeProgress,
  effectiveStatus,
};
