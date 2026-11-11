const crypto = require('crypto');
const prisma = require('../prisma');
const { getSettings } = require('../utils/settings');
const { markAbsentees } = require('../utils/absentees');

// Attendance: the meeting's QR code opens a page where an SK official picks their name
// (Present). Once the meeting is over, the officials not marked present are recorded as Absent.

// GET /api/attendance/event/:eventId - list attendance for an event (SK side):
// Present first in the order they checked in, then Absent by name.
async function getEventAttendance(req, res, next) {
  try {
    await markAbsentees({ eventId: req.params.eventId });
    const records = await prisma.attendanceRecord.findMany({
      where: { eventId: req.params.eventId },
      orderBy: [{ status: 'asc' }, { timeIn: 'asc' }, { participant: 'asc' }],
      select: { id: true, eventId: true, officialId: true, participant: true, status: true, timeIn: true },
    });
    res.json({ records });
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/summary/:eventId - SK side. Tally by status.
async function getEventSummary(req, res, next) {
  try {
    await markAbsentees({ eventId: req.params.eventId });
    const grouped = await prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { eventId: req.params.eventId },
      _count: { _all: true },
    });
    const summary = { PRESENT: 0, ABSENT: 0 };
    grouped.forEach((g) => {
      summary[g.status] = g._count._all;
    });
    summary.total = Object.values(summary).reduce((a, b) => a + b, 0);
    res.json({ summary });
  } catch (err) {
    next(err);
  }
}

// ---------- Attendance QR (SK Admin) ----------
// Each event has its own QR code: a random token that only works inside the window the
// SK Admin sets (at least 10 minutes). Deactivating stops it; regenerating gives a
// new token, so a downloaded or printed copy of the old one stops working.

const MIN = 60 * 1000;
const MIN_WINDOW_MIN = 10;
const DEFAULT_LENGTH = 3 * 60 * MIN; // events without an end time last 3 hours

const EVENT_FIELDS = {
  id: true,
  title: true,
  type: true,
  startAt: true,
  endAt: true,
  location: true,
  qrToken: true,
  qrActive: true,
  qrValidFrom: true,
  qrValidUntil: true,
};

// The default window: opens N minutes before the start; stays valid for the set length,
// or until the event ends.
function defaultWindow(event, settings) {
  const start = new Date(event.startAt).getTime();
  const from = start - settings.qrDefaultBeforeMin * MIN;
  const end = event.endAt ? new Date(event.endAt).getTime() : start + DEFAULT_LENGTH;
  let until = settings.qrDefaultLengthMin ? from + settings.qrDefaultLengthMin * MIN : end;
  if (until - from < MIN_WINDOW_MIN * MIN) until = from + MIN_WINDOW_MIN * MIN;
  return { validFrom: new Date(from), validUntil: new Date(until) };
}

function qrState(event, settings) {
  const { qrToken, ...info } = event;
  return {
    event: { id: info.id, title: info.title, type: info.type, startAt: info.startAt, endAt: info.endAt, location: info.location },
    qr: qrToken
      ? { token: qrToken, active: info.qrActive, validFrom: info.qrValidFrom, validUntil: info.qrValidUntil }
      : null,
    defaults: defaultWindow(event, settings),
    minMinutes: MIN_WINDOW_MIN,
  };
}

// Reads { validFrom, validUntil } from the body (falls back to the given window).
function readWindow(body, fallback) {
  const validFrom = body.validFrom ? new Date(body.validFrom) : fallback.validFrom;
  const validUntil = body.validUntil ? new Date(body.validUntil) : fallback.validUntil;
  if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime())) {
    return { error: 'Enter a valid start and end for the QR code' };
  }
  if (validUntil.getTime() - validFrom.getTime() < MIN_WINDOW_MIN * MIN) {
    return { error: `The QR code must stay valid for at least ${MIN_WINDOW_MIN} minutes` };
  }
  return { validFrom, validUntil };
}

async function loadEvent(id) {
  return prisma.event.findUnique({ where: { id }, select: EVENT_FIELDS });
}

// GET /api/attendance/qr/:eventId - the event's QR state (token included).
async function getQrCode(req, res, next) {
  try {
    const event = await loadEvent(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(qrState(event, await getSettings()));
  } catch (err) {
    next(err);
  }
}

// POST /api/attendance/qr/:eventId - { validFrom?, validUntil?, regenerate? }.
// Generates the event's QR (or a new one when regenerate is true) and activates it.
async function generateQr(req, res, next) {
  try {
    const event = await loadEvent(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    const settings = await getSettings();
    const current = event.qrValidFrom && event.qrValidUntil
      ? { validFrom: event.qrValidFrom, validUntil: event.qrValidUntil }
      : defaultWindow(event, settings);
    const win = readWindow(req.body || {}, current);
    if (win.error) return res.status(400).json({ message: win.error });
    const newToken = !event.qrToken || Boolean(req.body?.regenerate);
    const updated = await prisma.event.update({
      where: { id: event.id },
      data: {
        qrToken: newToken ? crypto.randomBytes(18).toString('base64url') : event.qrToken,
        qrActive: true,
        qrValidFrom: win.validFrom,
        qrValidUntil: win.validUntil,
      },
      select: EVENT_FIELDS,
    });
    res.json(qrState(updated, settings));
  } catch (err) {
    next(err);
  }
}

// PUT /api/attendance/qr/:eventId - { active } to deactivate/reactivate, and/or
// { validFrom, validUntil } to change how long it stays valid.
async function updateQr(req, res, next) {
  try {
    const event = await loadEvent(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!event.qrToken) return res.status(400).json({ message: 'Generate the QR code first' });
    const data = {};
    if (req.body.active !== undefined) data.qrActive = Boolean(req.body.active);
    if (req.body.validFrom !== undefined || req.body.validUntil !== undefined) {
      const win = readWindow(req.body, { validFrom: event.qrValidFrom, validUntil: event.qrValidUntil });
      if (win.error) return res.status(400).json({ message: win.error });
      data.qrValidFrom = win.validFrom;
      data.qrValidUntil = win.validUntil;
    }
    const updated = await prisma.event.update({ where: { id: event.id }, data, select: EVENT_FIELDS });
    res.json(qrState(updated, await getSettings()));
  } catch (err) {
    next(err);
  }
}

function sameToken(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

const publicEvent = (e) => ({ id: e.id, title: e.title, startAt: e.startAt, endAt: e.endAt, location: e.location });

// Whether the QR attendance page accepts names right now. Returns null when it is open,
// otherwise { code, message } (the page then shows "Attendance is closed.").
function closedReason(event, token) {
  if (!event.qrToken || !sameToken(token, event.qrToken)) {
    return { code: 'INVALID', message: 'This QR code is no longer valid. Scan the QR code shown at the meeting.' };
  }
  const now = Date.now();
  if (
    !event.qrActive ||
    (event.qrValidFrom && now < new Date(event.qrValidFrom).getTime()) ||
    (event.qrValidUntil && now > new Date(event.qrValidUntil).getTime())
  ) {
    return { code: 'CLOSED', message: 'Attendance is closed.' };
  }
  return null;
}

// Active SK officials not yet marked Present for the meeting (the dropdown).
async function namesLeft(eventId) {
  const [officials, present] = await Promise.all([
    prisma.official.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, position: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { eventId, status: 'PRESENT', officialId: { not: null } },
      select: { officialId: true },
    }),
  ]);
  const done = new Set(present.map((p) => p.officialId));
  return officials.filter((o) => !done.has(o.id));
}

// GET /api/attendance/public/:eventId?t=TOKEN - public: the QR attendance page.
// { event, open, message?, officials } where officials are the names still to mark.
async function getAttendancePage(req, res, next) {
  try {
    const event = await loadEvent(req.params.eventId);
    if (!event) return res.status(404).json({ code: 'NOT_FOUND', message: 'This meeting was not found.' });
    const closed = closedReason(event, req.query.t);
    if (closed) return res.json({ event: publicEvent(event), open: false, ...closed, officials: [] });
    res.json({ event: publicEvent(event), open: true, officials: await namesLeft(event.id) });
  } catch (err) {
    next(err);
  }
}

// POST /api/attendance/public/:eventId - public: { token, officialId } from the QR page.
// Marks the chosen SK official Present with the time. Each name only once per meeting.
async function markPresent(req, res, next) {
  try {
    const event = await loadEvent(req.params.eventId);
    if (!event) return res.status(404).json({ code: 'NOT_FOUND', message: 'This meeting was not found.' });
    const closed = closedReason(event, req.body.token);
    if (closed) return res.status(400).json(closed);
    const official = req.body.officialId
      ? await prisma.official.findFirst({ where: { id: String(req.body.officialId), isActive: true }, select: { id: true, name: true } })
      : null;
    if (!official) return res.status(400).json({ code: 'NO_NAME', message: 'Choose your name from the list.' });

    const now = new Date();
    const existing = await prisma.attendanceRecord.findFirst({ where: { eventId: event.id, officialId: official.id } });
    if (existing && existing.status === 'PRESENT') {
      return res.status(409).json({ code: 'ALREADY', message: `${official.name} is already marked present.` });
    }
    try {
      const record = existing
        ? await prisma.attendanceRecord.update({ where: { id: existing.id }, data: { status: 'PRESENT', timeIn: now } })
        : await prisma.attendanceRecord.create({
            data: { eventId: event.id, officialId: official.id, participant: official.name, status: 'PRESENT', timeIn: now },
          });
      res.status(201).json({ record, officials: await namesLeft(event.id) });
    } catch (err) {
      // Two submissions of the same name at the same moment: the second hits the unique rule.
      if (err.code === 'P2002') {
        return res.status(409).json({ code: 'ALREADY', message: `${official.name} is already marked present.` });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getQrCode,
  generateQr,
  updateQr,
  getAttendancePage,
  markPresent,
  getEventAttendance,
  getEventSummary,
};
