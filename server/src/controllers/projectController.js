const prisma = require('../prisma');
const { parsePhDate } = require('../utils/phTime');
const { receiptPath, removeReceiptFile } = require('../middleware/upload');
const { photosForProject } = require('./photoController');
const { isStaff } = require('../utils/roles');
const { notifyProject } = require('../utils/notifications');

// The SK project process. Each step only goes to the next stage; skipped stages are refused.
//   PENDING_APPROVAL -> APPROVED -> PURCHASING -> FUND_RELEASE -> IMPLEMENTATION -> LIQUIDATION -> COMPLETED
// - PENDING_APPROVAL: the SK Admin uploads and checks the stage's documents, then submits the
//   request. The Barangay Chairman approves it (-> APPROVED) or rejects it with remarks (-> REJECTED).
// - APPROVED: the SK Admin sets the schedule (start and end), then proceeds to Purchasing.
// - PURCHASING to LIQUIDATION: "Proceed to Next Stage" only when every required document of the
//   current stage has enough checked uploads (and, at Liquidation, the amount spent is entered).
// - ON_HOLD (from Approved to Liquidation): paused; it resumes at the same stage.
// - COMPLETED -> ARCHIVED: filed away. Completed, rejected and archived projects are view only.
// Every stage change is written to ProjectStageLog.

const FLOW = ['PENDING_APPROVAL', 'APPROVED', 'PURCHASING', 'FUND_RELEASE', 'IMPLEMENTATION', 'LIQUIDATION', 'COMPLETED'];
// Stages that can be put on hold and moved forward with "Proceed to Next Stage".
const WORK_STAGES = ['APPROVED', 'PURCHASING', 'FUND_RELEASE', 'IMPLEMENTATION', 'LIQUIDATION'];
// The stages the staff's Projects list shows (the rest are in Archives).
const ACTIVE_STATUSES = ['PENDING_APPROVAL', ...WORK_STAGES, 'ON_HOLD'];
// What the public site may show (approved and not paused, rejected or filed away).
const PUBLIC_STATUSES = [...WORK_STAGES, 'COMPLETED'];
const CLOSED_STATUSES = ['COMPLETED', 'REJECTED', 'ARCHIVED'];
const STAGE_NAME = {
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  PURCHASING: 'Purchasing',
  FUND_RELEASE: 'Fund Release',
  IMPLEMENTATION: 'Implementation',
  LIQUIDATION: 'Liquidation',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  ON_HOLD: 'On Hold',
  ARCHIVED: 'Archived',
};

// Archived (deleted) projects are kept for the record but cannot be changed.
const ARCHIVED_MESSAGE = 'This project is archived and can no longer be changed';
const CLOSED_MESSAGE = 'This project is closed and can only be viewed';
// Asking to delete a project needs a real reason (the client checks the same).
const MIN_REASON_LENGTH = 10;

// Shared include so lists and details always carry the team, creator, the latest deletion
// request, the purchase requests and the uploaded documents.
const includeOpts = {
  officials: { orderBy: { displayOrder: 'asc' } },
  createdBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  // Latest deletion request (any status) so the UI can show pending/rejected.
  deletionRequests: { orderBy: { createdAt: 'desc' }, take: 1 },
  requestItems: { orderBy: { displayOrder: 'asc' } },
  documents: {
    orderBy: { uploadedAt: 'asc' },
    select: {
      id: true,
      requiredDocumentId: true,
      originalName: true,
      mimeType: true,
      isChecked: true,
      uploadedAt: true,
      uploadedBy: { select: { id: true, name: true } },
    },
  },
};
// One project's page also carries its stage history.
const detailInclude = {
  ...includeOpts,
  stageLogs: { orderBy: { changedAt: 'asc' }, include: { changedBy: { select: { id: true, name: true } } } },
};

const requiredDocuments = () =>
  prisma.requiredDocument.findMany({ orderBy: [{ stage: 'asc' }, { displayOrder: 'asc' }] });

// The stage whose documents count right now (an On Hold project keeps the stage it paused at).
const docStage = (project) => (project.status === 'ON_HOLD' ? project.heldFromStatus : project.status);

// The checklist of every stage that has documents, with each project's uploads, and what
// still stands between the project and the next stage.
function stageInfo(project, required) {
  const files = project.documents || [];
  const stages = [];
  for (const rd of required) {
    let group = stages.find((g) => g.stage === rd.stage);
    if (!group) {
      group = { stage: rd.stage, label: STAGE_NAME[rd.stage], documents: [] };
      stages.push(group);
    }
    const uploads = files.filter((f) => f.requiredDocumentId === rd.id);
    const checked = uploads.filter((f) => f.isChecked).length;
    group.documents.push({
      id: rd.id,
      name: rd.name,
      minFiles: rd.minFiles,
      files: uploads,
      checkedCount: checked,
      complete: checked >= rd.minFiles,
    });
  }
  stages.sort((a, b) => FLOW.indexOf(a.stage) - FLOW.indexOf(b.stage));
  stages.forEach((g) => {
    g.complete = g.documents.every((d) => d.complete);
  });

  const current = stages.find((g) => g.stage === docStage(project));
  const missing = [];
  (current?.documents || []).forEach((d) => {
    if (d.complete) return;
    if (d.minFiles > 1) missing.push(`${d.name} (at least ${d.minFiles} checked files, ${d.checkedCount} so far)`);
    else missing.push(d.files.length ? `${d.name} (not checked yet)` : d.name);
  });
  if (project.status === 'APPROVED' && !(project.startDate && project.endDate)) {
    missing.push('The schedule (start and end date)');
  }
  if (project.status === 'LIQUIDATION' && project.amountSpent == null) {
    missing.push('The amount spent');
  }

  const index = FLOW.indexOf(project.status);
  const canMove = WORK_STAGES.includes(project.status);
  return {
    checklist: stages,
    docsChecked: current ? current.documents.filter((d) => d.complete).length : 0,
    docsTotal: current ? current.documents.length : 0,
    stageMissing: missing,
    nextStatus: canMove ? FLOW[index + 1] : null,
    canProceed: canMove && missing.length === 0,
    canSubmit: project.status === 'PENDING_APPROVAL' && !project.submittedAt && missing.length === 0,
  };
}

// The SK side (admin, chairman, officials) sees everything; the public never sees
// requests, rejected or archived projects, the documents or the stage history.
function canSeeInternal(user) {
  return isStaff(user);
}

function stripInternal(project) {
  const {
    deletionRequests,
    documents,
    stageLogs,
    checklist,
    stageMissing,
    rejectionRemarks,
    canProceed,
    canSubmit,
    ...rest
  } = project;
  return rest;
}

// GET /api/projects — public.
//   ?archive=completed|rejected|archived|deleted (SK side) lists one tab of Archives
//   (the old names cancelled and onhold still work); ?archive=all (SK side) lists every
//   project that is not deleted (the Dashboard); otherwise the active projects.
//   ?status=A,B narrows the list to those stages; ?submitted=true keeps only requests that
//   were submitted to the Barangay Chairman (his Approvals list).
async function getProjects(req, res, next) {
  try {
    const { category, archive } = req.query;
    const staff = canSeeInternal(req.user);
    const statuses = req.query.status ? String(req.query.status).split(',').filter((s) => STAGE_NAME[s]) : null;
    const where = { archivedAt: null };
    if (category) where.category = category;
    if (staff && archive === 'deleted') where.archivedAt = { not: null };
    else if (staff && archive === 'completed') where.status = 'COMPLETED';
    else if (staff && (archive === 'rejected' || archive === 'cancelled')) where.status = 'REJECTED';
    else if (staff && (archive === 'archived' || archive === 'onhold')) where.status = 'ARCHIVED';
    else if (staff && archive === 'all') {
      // every stage
    } else if (staff) {
      where.status = { in: statuses || ACTIVE_STATUSES };
    } else {
      where.status = { in: statuses ? statuses.filter((s) => PUBLIC_STATUSES.includes(s)) : PUBLIC_STATUSES };
      where.approvalState = 'APPROVED';
    }
    if (staff && req.query.submitted === 'true') where.submittedAt = { not: null };

    const [projects, required] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: archive ? { updatedAt: 'desc' } : { createdAt: 'desc' },
        include: includeOpts,
      }),
      requiredDocuments(),
    ]);
    let result = projects.map((p) => ({ ...p, ...stageInfo(p, required) }));
    if (!staff) result = result.map(stripInternal);
    res.json({ projects: result });
  } catch (err) {
    next(err);
  }
}

// Loads one project with its checklist and stage history.
async function projectWithInfo(id) {
  const [project, required] = await Promise.all([
    prisma.project.findUnique({ where: { id }, include: detailInclude }),
    requiredDocuments(),
  ]);
  return project ? { ...project, ...stageInfo(project, required) } : null;
}

// GET /api/projects/:id — public (the SK side also gets the checklist and the stage history).
async function getProject(req, res, next) {
  try {
    const project = await projectWithInfo(req.params.id);
    const hiddenFromPublic =
      project && ((!PUBLIC_STATUSES.includes(project.status) && project.status !== 'ON_HOLD') || project.archivedAt);
    if (!project || (hiddenFromPublic && !canSeeInternal(req.user))) {
      return res.status(404).json({ message: 'Project not found' });
    }
    // Progress photos shown on the public project page
    project.photos = await photosForProject(project.id);
    res.json({ project: canSeeInternal(req.user) ? project : stripInternal(project) });
  } catch (err) {
    next(err);
  }
}

// Today's date in the Philippines, as YYYY-MM-DD.
const phToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

// Turns the form's purchase request rows into rows ready to save. Blank rows are
// dropped; amounts must be numbers that are not negative. Returns null when the
// body sent no rows at all (so an update leaves the saved rows alone).
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

// Normalize the Project Request form into Prisma-ready data + team ids. The status and
// the schedule are not accepted here: they only change through the flow's own steps.
function parseProjectBody(body, keepDates) {
  const { title, description, category, budget, location, coverImageUrl, officialIds, proposedByName, proposedByPosition, abyipItem } = body;

  const data = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (category !== undefined) data.category = category;
  if (budget !== undefined) data.budget = budget;
  if (location !== undefined) data.location = location;
  if (coverImageUrl !== undefined) data.coverImageUrl = coverImageUrl;
  if (abyipItem !== undefined) data.abyipItem = String(abyipItem || '').trim().slice(0, 200) || null;
  // "Prepared by" on the request form; blank clears it.
  if (proposedByName !== undefined) data.proposedByName = proposedByName || null;
  if (proposedByPosition !== undefined) data.proposedByPosition = proposedByPosition || null;

  // The budget is the total of the purchase request amounts, when any are given.
  const requestItems = cleanRequestItems(body.requestItems, keepDates);
  if (requestItems) {
    const total = requestItems.reduce((sum, i) => sum + i.amount, 0);
    if (total > 0) data.budget = total;
  }

  return { data, officialIds, requestItems };
}

const round2 = (n) => Math.round(n * 100) / 100;

// Loads a project for a change and refuses deleted or closed ones.
// Returns { project } or { error: [status, message] }.
async function loadOpen(id) {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return { error: [404, 'Project not found'] };
  if (project.archivedAt) return { error: [400, ARCHIVED_MESSAGE] };
  if (CLOSED_STATUSES.includes(project.status)) return { error: [400, CLOSED_MESSAGE] };
  return { project };
}

// Like loadOpen, and the project must be at one of the given stages.
async function loadAtStage(id, stages, action) {
  const r = await loadOpen(id);
  if (r.error) return r;
  const list = [].concat(stages);
  if (!list.includes(r.project.status)) {
    return { error: [400, `${action} is only possible while the project is ${list.map((s) => STAGE_NAME[s]).join(' or ')}`] };
  }
  return r;
}

const fail = (res, [code, message]) => res.status(code).json({ message });

// Moves a project to another stage and writes the stage history in one transaction.
async function moveStage(project, toStatus, user, { data = {}, remarks = null } = {}) {
  await prisma.$transaction([
    prisma.project.update({ where: { id: project.id }, data: { ...data, status: toStatus } }),
    prisma.projectStageLog.create({
      data: {
        projectId: project.id,
        fromStatus: project.status,
        toStatus,
        remarks: remarks || null,
        changedById: user.id,
      },
    }),
  ]);
  return projectWithInfo(project.id);
}

const cleanRemarks = (value) => String(value || '').trim().slice(0, 1000);

// POST /api/projects — SK Admin. The Project Request: saved at Pending Approval. The SK Admin
// then uploads its documents and submits it to the Barangay Chairman.
async function createProject(req, res, next) {
  try {
    if (!req.body.title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    const { data, officialIds, requestItems } = parseProjectBody(req.body);
    if (requestItems && requestItems.length > 0) {
      data.requestItems = { create: requestItems };
    }
    data.status = 'PENDING_APPROVAL';
    data.approvalState = 'PENDING';
    data.createdById = req.user.id;
    data.stageLogs = {
      create: { fromStatus: null, toStatus: 'PENDING_APPROVAL', remarks: 'Project Request created', changedById: req.user.id },
    };
    if (Array.isArray(officialIds)) {
      data.officials = { connect: officialIds.map((id) => ({ id })) };
    }

    const created = await prisma.project.create({ data });
    res.status(201).json({ project: await projectWithInfo(created.id) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/projects/:id — SK Admin. Edits the request details (not the stage or schedule).
// At Liquidation it also takes { amountSpent }; the amount returned is worked out here.
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
    const { data, officialIds, requestItems } = parseProjectBody(req.body, keepDates);
    if (requestItems) {
      // The sheet is saved as a whole: replace all rows with the ones sent.
      data.requestItems = { deleteMany: {}, create: requestItems };
    }
    if (Array.isArray(officialIds)) {
      // "set" replaces the whole team with the provided ids.
      data.officials = { set: officialIds.map((id) => ({ id })) };
    }

    const budget = Number(data.budget ?? r.project.budget ?? 0);
    if (req.body.amountSpent !== undefined) {
      if (r.project.status !== 'LIQUIDATION') {
        return res.status(400).json({ message: 'The amount spent is entered at the Liquidation stage' });
      }
      const spent = Number(req.body.amountSpent);
      if (req.body.amountSpent === '' || req.body.amountSpent === null || !Number.isFinite(spent) || spent < 0) {
        return res.status(400).json({ message: 'Enter the amount spent as a number that is not negative' });
      }
      if (round2(spent) > round2(budget)) {
        return res.status(400).json({ message: 'The amount spent cannot be more than the budget' });
      }
      data.amountSpent = round2(spent);
      data.amountReturned = round2(budget - spent);
    } else if (data.budget !== undefined && r.project.amountSpent != null) {
      // A new budget changes what goes back.
      data.amountReturned = round2(budget - Number(r.project.amountSpent));
    }

    await prisma.project.update({ where: { id: req.params.id }, data });
    res.json({ project: await projectWithInfo(req.params.id) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/projects/:id/submit — SK Admin. Sends a Pending Approval request, with all its
// documents uploaded and checked, to the Barangay Chairman.
async function submitProject(req, res, next) {
  try {
    const r = await loadAtStage(req.params.id, 'PENDING_APPROVAL', 'Submitting the request');
    if (r.error) return fail(res, r.error);
    if (r.project.submittedAt) {
      return res.status(400).json({ message: 'This request was already submitted to the Barangay Chairman' });
    }
    const current = await projectWithInfo(req.params.id);
    if (current.stageMissing.length > 0) {
      return res.status(400).json({
        message: `Complete the documents first: ${current.stageMissing.join(', ')}`,
        missing: current.stageMissing,
      });
    }
    await prisma.$transaction([
      prisma.project.update({ where: { id: r.project.id }, data: { submittedAt: new Date(), approvalState: 'PENDING' } }),
      prisma.projectStageLog.create({
        data: {
          projectId: r.project.id,
          fromStatus: 'PENDING_APPROVAL',
          toStatus: 'PENDING_APPROVAL',
          remarks: 'Submitted to the Barangay Chairman for approval',
          changedById: req.user.id,
        },
      }),
    ]);
    await notifyProject({
      projectId: r.project.id,
      type: 'REQUEST_SUBMITTED',
      audience: 'CHAIRMAN',
      title: `Waiting for your approval: ${r.project.title}`,
      message: `The SK Admin submitted the Project Request "${r.project.title}" with its documents. Please approve or reject it.`,
    });
    res.json({ project: await projectWithInfo(r.project.id) });
  } catch (err) {
    next(err);
  }
}

// Loads a request the Barangay Chairman can decide on: Pending Approval and submitted.
async function loadSubmitted(id) {
  const r = await loadAtStage(id, 'PENDING_APPROVAL', 'Approving or rejecting');
  if (r.error) return r;
  if (!r.project.submittedAt) return { error: [400, 'The SK Admin has not submitted this request yet'] };
  return r;
}

// PATCH /api/projects/:id/approve — Barangay Chairman. { remarks? } -> Approved.
async function approveProject(req, res, next) {
  try {
    const r = await loadSubmitted(req.params.id);
    if (r.error) return fail(res, r.error);
    const remarks = cleanRemarks(req.body?.remarks);
    const project = await moveStage(r.project, 'APPROVED', req.user, {
      remarks: remarks || 'Approved by the Barangay Chairman',
      data: {
        approvalState: 'APPROVED',
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        reviewRemarks: remarks || null,
        rejectionRemarks: null,
      },
    });
    await notifyProject({
      projectId: r.project.id,
      type: 'REQUEST_APPROVED',
      audience: 'ADMIN',
      title: `Approved: ${r.project.title}`,
      message: `The Barangay Chairman approved "${r.project.title}". Set its schedule, then proceed to Purchasing.${remarks ? ` Remarks: ${remarks}` : ''}`,
    });
    res.json({ project });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/projects/:id/reject — Barangay Chairman. { remarks } (required) -> Rejected.
async function rejectProject(req, res, next) {
  try {
    const r = await loadSubmitted(req.params.id);
    if (r.error) return fail(res, r.error);
    const remarks = cleanRemarks(req.body?.remarks);
    if (!remarks) return res.status(400).json({ message: 'Remarks are required when rejecting a request' });
    const project = await moveStage(r.project, 'REJECTED', req.user, {
      remarks,
      data: {
        approvalState: 'REJECTED',
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        reviewRemarks: remarks,
        rejectionRemarks: remarks,
      },
    });
    await notifyProject({
      projectId: r.project.id,
      type: 'REQUEST_REJECTED',
      audience: 'ADMIN',
      title: `Rejected: ${r.project.title}`,
      message: `The Barangay Chairman rejected "${r.project.title}". Remarks: ${remarks}`,
    });
    res.json({ project });
  } catch (err) {
    next(err);
  }
}

// PUT /api/projects/:id/schedule — SK Admin, while Approved. { startDate, endDate } (date and
// time). Needed before the project can proceed to Purchasing.
async function setSchedule(req, res, next) {
  try {
    const r = await loadAtStage(req.params.id, 'APPROVED', 'Setting the schedule');
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
    await prisma.project.update({ where: { id: req.params.id }, data: { startDate: start, endDate: end } });
    res.json({ project: await projectWithInfo(req.params.id) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/projects/:id/next-stage — SK Admin. { remarks? } Approved -> Purchasing -> Fund
// Release -> Implementation -> Liquidation -> Completed, only when the current stage is complete.
async function nextStage(req, res, next) {
  try {
    const r = await loadAtStage(req.params.id, WORK_STAGES, 'Proceeding to the next stage');
    if (r.error) return fail(res, r.error);
    const current = await projectWithInfo(req.params.id);
    if (!current.canProceed) {
      return res.status(400).json({
        message: `The ${STAGE_NAME[current.status]} stage is not complete. Still missing: ${current.stageMissing.join(', ')}`,
        missing: current.stageMissing,
      });
    }
    const project = await moveStage(r.project, current.nextStatus, req.user, { remarks: cleanRemarks(req.body?.remarks) });
    res.json({ project });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/projects/:id/hold — SK Admin. { remarks? } Puts an Approved to Liquidation project
// on hold, or resumes an On Hold project at the stage it was paused at.
async function toggleHold(req, res, next) {
  try {
    const r = await loadAtStage(req.params.id, [...WORK_STAGES, 'ON_HOLD'], 'Holding or resuming');
    if (r.error) return fail(res, r.error);
    const remarks = cleanRemarks(req.body?.remarks);
    let project;
    if (r.project.status === 'ON_HOLD') {
      const back = WORK_STAGES.includes(r.project.heldFromStatus) ? r.project.heldFromStatus : 'IMPLEMENTATION';
      project = await moveStage(r.project, back, req.user, {
        remarks: remarks || 'Resumed',
        data: { heldFromStatus: null },
      });
    } else {
      project = await moveStage(r.project, 'ON_HOLD', req.user, {
        remarks: remarks || 'Put on hold',
        data: { heldFromStatus: r.project.status },
      });
    }
    res.json({ project });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/projects/:id/archive — SK Admin. Completed -> Archived (read only).
async function archiveProject(req, res, next) {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.archivedAt) return res.status(400).json({ message: ARCHIVED_MESSAGE });
    if (project.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'Only completed projects can be archived' });
    }
    res.json({ project: await moveStage(project, 'ARCHIVED', req.user, { remarks: cleanRemarks(req.body?.remarks) || 'Archived' }) });
  } catch (err) {
    next(err);
  }
}

// ---------- Stage documents ----------

// The documents of the current stage can be changed by the SK Admin; a Pending Approval
// request is locked once it is submitted, and an On Hold project until it is resumed.
async function loadForDocuments(id) {
  const r = await loadOpen(id);
  if (r.error) return r;
  const { project } = r;
  if (project.status === 'ON_HOLD') return { error: [400, 'Resume the project before changing its documents'] };
  if (project.status === 'PENDING_APPROVAL' && project.submittedAt) {
    return { error: [400, 'The request was submitted; its documents are locked while the Barangay Chairman decides'] };
  }
  return r;
}

// POST /api/projects/:id/documents — SK Admin. multipart: requiredDocumentId + "files"
// (PDF, JPG or PNG, up to 10 MB each). Only for a document of the current stage.
async function uploadDocuments(req, res, next) {
  const files = req.files || [];
  const discard = () => files.forEach((f) => removeReceiptFile(f.filename));
  try {
    const r = await loadForDocuments(req.params.id);
    if (r.error) {
      discard();
      return fail(res, r.error);
    }
    const rd = req.body.requiredDocumentId
      ? await prisma.requiredDocument.findUnique({ where: { id: String(req.body.requiredDocumentId) } })
      : null;
    if (!rd) {
      discard();
      return res.status(400).json({ message: 'Choose which document the files are for' });
    }
    if (rd.stage !== r.project.status) {
      discard();
      return res.status(400).json({ message: `${rd.name} belongs to the ${STAGE_NAME[rd.stage]} stage, not the current one` });
    }
    if (files.length === 0) return res.status(400).json({ message: 'Choose at least one file to upload' });
    await prisma.projectDocument.createMany({
      data: files.map((f) => ({
        projectId: r.project.id,
        requiredDocumentId: rd.id,
        fileUrl: f.filename,
        originalName: f.originalname,
        mimeType: f.mimetype,
        uploadedById: req.user.id,
      })),
    });
    res.status(201).json({ project: await projectWithInfo(r.project.id) });
  } catch (err) {
    discard();
    next(err);
  }
}

// Loads an uploaded document of a project that the SK Admin may still change.
async function loadDocument(req) {
  const r = await loadForDocuments(req.params.id);
  if (r.error) return r;
  const doc = await prisma.projectDocument.findUnique({
    where: { id: req.params.docId },
    include: { requiredDocument: true },
  });
  if (!doc || doc.projectId !== r.project.id) return { error: [404, 'Document not found'] };
  if (doc.requiredDocument.stage !== r.project.status) {
    return { error: [400, `Documents of the ${STAGE_NAME[doc.requiredDocument.stage]} stage can no longer be changed`] };
  }
  return { ...r, doc };
}

// PATCH /api/projects/:id/documents/:docId/check — SK Admin. { isChecked } (toggles when left out)
async function checkDocument(req, res, next) {
  try {
    const r = await loadDocument(req);
    if (r.error) return fail(res, r.error);
    const isChecked = typeof req.body?.isChecked === 'boolean' ? req.body.isChecked : !r.doc.isChecked;
    await prisma.projectDocument.update({ where: { id: r.doc.id }, data: { isChecked } });
    res.json({ project: await projectWithInfo(r.project.id) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/projects/:id/documents/:docId — SK Admin. Removes a wrong upload.
async function deleteDocument(req, res, next) {
  try {
    const r = await loadDocument(req);
    if (r.error) return fail(res, r.error);
    await prisma.projectDocument.delete({ where: { id: r.doc.id } });
    // The same stored file can still belong to an old expense record; keep it then.
    const stillUsed = await prisma.expense.count({ where: { receiptFile: r.doc.fileUrl } });
    if (!stillUsed) removeReceiptFile(r.doc.fileUrl);
    res.json({ project: await projectWithInfo(r.project.id) });
  } catch (err) {
    next(err);
  }
}

// GET /api/projects/:id/documents/:docId/file — SK side (also view only from Archives).
async function getDocumentFile(req, res, next) {
  try {
    const doc = await prisma.projectDocument.findUnique({ where: { id: req.params.docId } });
    if (!doc || doc.projectId !== req.params.id) {
      return res.status(404).json({ message: 'File not found' });
    }
    res.type(doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.originalName || 'document')}`);
    res.sendFile(receiptPath(doc.fileUrl), (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'The file is missing' });
    });
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
    await prisma.project.update({
      where: { id: req.params.id },
      data: { archivedAt: null, archivedReason: null, archivedByName: null },
    });
    res.json({ project: await projectWithInfo(req.params.id) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProjects,
  getProject,
  createProject,
  updateProject,
  submitProject,
  approveProject,
  rejectProject,
  setSchedule,
  nextStage,
  toggleHold,
  archiveProject,
  uploadDocuments,
  checkDocument,
  deleteDocument,
  getDocumentFile,
  requestDeletion,
  withdrawDeletion,
  listDeletionRequests,
  reviewDeletion,
  restoreProject,
  STAGE_NAME,
  WORK_STAGES,
  ACTIVE_STATUSES,
};
