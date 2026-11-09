const prisma = require('../prisma');
const { effectiveStatus, computeProgress } = require('./projectController');

// Data behind the PDF and Excel exports (Dashboard and Attendance). Dates in the filters
// are calendar days in Philippine time (YYYY-MM-DD).

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const startOfDay = (d) => new Date(`${d}T00:00:00+08:00`);
const endOfDay = (d) => new Date(`${d}T23:59:59.999+08:00`);

function readRange(q) {
  const from = DAY.test(String(q.from || '')) ? startOfDay(q.from) : null;
  const to = DAY.test(String(q.to || '')) ? endOfDay(q.to) : null;
  if (from && to && from > to) {
    const err = new Error('The "From" date must be on or before the "To" date');
    err.status = 400;
    throw err;
  }
  return { from, to };
}

function rangeWhere(field, { from, to }) {
  if (!from && !to) return {};
  const cond = {};
  if (from) cond.gte = from;
  if (to) cond.lte = to;
  return { [field]: cond };
}

// The SK officials whose attendance is expected: active official accounts.
async function expectedOfficials() {
  return prisma.user.findMany({
    where: { role: 'OFFICIAL', isActive: true },
    select: { id: true, name: true, official: { select: { position: true, displayOrder: true } } },
    orderBy: [{ official: { displayOrder: 'asc' } }, { name: 'asc' }],
  });
}

const ended = (e, now) => new Date(e.endAt || e.startAt) <= now;

// Every attendance row for the events: the recorded ones, plus an Absent row for each
// expected official with no record once the event has ended.
function attendanceRows(events, officials, now) {
  const byId = new Map(officials.map((o) => [o.id, o]));
  const rows = [];
  events.forEach((e) => {
    const seen = new Set();
    e.attendance.forEach((r) => {
      if (r.userId) seen.add(r.userId);
      const o = r.userId ? byId.get(r.userId) : null;
      rows.push({
        userId: r.userId,
        officialName: r.participant,
        position: o?.official?.position || r.user?.official?.position || '',
        eventId: e.id,
        eventName: e.title,
        eventDate: e.startAt,
        timeIn: r.timeIn,
        status: r.status,
        method: r.method === 'MANUAL' ? 'Manual' : 'QR',
      });
    });
    if (ended(e, now)) {
      officials.forEach((o) => {
        if (seen.has(o.id)) return;
        rows.push({
          userId: o.id,
          officialName: o.name,
          position: o.official?.position || '',
          eventId: e.id,
          eventName: e.title,
          eventDate: e.startAt,
          timeIn: null,
          status: 'ABSENT',
          method: 'No scan',
        });
      });
    }
  });
  return rows;
}

// Present / Late / Absent per official, and their attendance rate.
function perOfficial(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const key = r.userId || `name:${r.officialName}`;
    if (!map.has(key)) {
      map.set(key, { name: r.officialName, position: r.position, present: 0, late: 0, absent: 0, excused: 0 });
    }
    const m = map.get(key);
    m[r.status.toLowerCase()] += 1;
  });
  return [...map.values()].map((m) => {
    const counted = m.present + m.late + m.absent;
    return { ...m, rate: counted > 0 ? Math.round(((m.present + m.late) / counted) * 100) : null };
  });
}

function totals(rows) {
  const t = { present: 0, late: 0, absent: 0, excused: 0 };
  rows.forEach((r) => {
    t[r.status.toLowerCase()] += 1;
  });
  const counted = t.present + t.late + t.absent;
  return { ...t, rate: counted > 0 ? Math.round(((t.present + t.late) / counted) * 100) : null };
}

const EVENT_SELECT = {
  id: true,
  title: true,
  type: true,
  startAt: true,
  endAt: true,
  location: true,
  attendance: {
    orderBy: { createdAt: 'asc' },
    select: {
      userId: true,
      participant: true,
      status: true,
      timeIn: true,
      method: true,
    },
  },
};

// One project's own figures, for an export narrowed to it.
async function projectSummary(projectId) {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      tasks: { select: { done: true } },
      events: { select: { id: true, startAt: true, endAt: true } },
      expenses: { select: { amount: true } },
    },
  });
  if (!p) return null;
  const status = effectiveStatus(p);
  const { progress } = computeProgress({ ...p, status });
  const spent = p.expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  return {
    id: p.id,
    title: p.title,
    category: p.category,
    status,
    progress,
    budget: Number(p.budget || 0),
    spent,
    tasksDone: p.tasks.filter((t) => t.done).length,
    tasksTotal: p.tasks.length,
    startDate: p.startDate,
    endDate: p.endDate,
    location: p.location,
  };
}

// GET /api/reports/dashboard?from&to&projectId
// With projectId, only that project and the events linked to it are reported.
async function dashboardReport(req, res, next) {
  try {
    const range = readRange(req.query);
    const now = new Date();
    const projectId = req.query.projectId ? String(req.query.projectId) : null;
    const project = projectId ? await projectSummary(projectId) : null;
    if (projectId && !project) return res.status(404).json({ message: 'Project not found' });

    // Projects active in the range: their timeline overlaps it (or, without dates, they
    // were created in it). Archived and rejected ones are left out, as on the Dashboard.
    const projects = await prisma.project.findMany({
      where: projectId ? { id: projectId } : { archivedAt: null, approvalState: { not: 'REJECTED' } },
      select: { id: true, title: true, status: true, startDate: true, endDate: true, createdAt: true },
    });
    const inRange = projects.filter((p) => {
      if (projectId || (!range.from && !range.to)) return true;
      const start = p.startDate ? new Date(p.startDate) : new Date(p.createdAt);
      const end = p.endDate ? new Date(p.endDate) : start;
      return (!range.to || start <= range.to) && (!range.from || end >= range.from);
    });
    const byStatus = { Planned: 0, Ongoing: 0, Completed: 0, Cancelled: 0 };
    inRange.forEach((p) => {
      const s = effectiveStatus(p);
      if (s === 'PROPOSED' || s === 'PLANNING') byStatus.Planned += 1;
      else if (s === 'ONGOING') byStatus.Ongoing += 1;
      else if (s === 'COMPLETED') byStatus.Completed += 1;
      else if (s === 'CANCELLED') byStatus.Cancelled += 1;
    });
    const total = inRange.length;
    const completionRate = total > 0 ? Math.round((byStatus.Completed / total) * 100) : null;

    const [events, officials] = await Promise.all([
      prisma.event.findMany({
        where: { ...rangeWhere('startAt', range), ...(projectId ? { relatedProjectId: projectId } : {}) },
        orderBy: { startAt: 'asc' },
        select: EVENT_SELECT,
      }),
      expectedOfficials(),
    ]);
    const rows = attendanceRows(events, officials, now);
    const perEvent = events.map((e) => {
      const t = totals(rows.filter((r) => r.eventId === e.id));
      return { id: e.id, title: e.title, type: e.type, startAt: e.startAt, ...t, held: ended(e, now) };
    });

    res.json({
      range: { from: req.query.from || null, to: req.query.to || null },
      project,
      projects: { total, byStatus, completionRate },
      events: events.map(({ attendance, ...e }) => e),
      attendance: { perEvent, perOfficial: perOfficial(rows), totals: totals(rows) },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/reports/attendance?eventId&from&to&userId&status
async function attendanceReport(req, res, next) {
  try {
    const range = readRange(req.query);
    const now = new Date();
    const where = rangeWhere('startAt', range);
    if (req.query.eventId) where.id = String(req.query.eventId);
    const [events, officials] = await Promise.all([
      prisma.event.findMany({ where, orderBy: { startAt: 'asc' }, select: EVENT_SELECT }),
      expectedOfficials(),
    ]);
    let rows = attendanceRows(events, officials, now);
    if (req.query.userId) rows = rows.filter((r) => r.userId === String(req.query.userId));
    if (req.query.status) rows = rows.filter((r) => r.status === String(req.query.status));
    rows.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate) || a.officialName.localeCompare(b.officialName));
    res.json({
      rows,
      summary: { totals: totals(rows), perOfficial: perOfficial(rows) },
      events: events.map((e) => ({ id: e.id, title: e.title, startAt: e.startAt })),
      officials: officials.map((o) => ({ id: o.id, name: o.name, position: o.official?.position || '' })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboardReport, attendanceReport };
