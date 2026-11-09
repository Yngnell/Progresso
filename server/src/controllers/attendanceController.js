const crypto = require('crypto');
const prisma = require('../prisma');
const { getSettings } = require('../utils/settings');

// GET /api/attendance/event/:eventId - list attendance for an event (SK side).
async function getEventAttendance(req, res, next) {
  try {
    const records = await prisma.attendanceRecord.findMany({
      where: { eventId: req.params.eventId },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ records });
  } catch (err) {
    next(err);
  }
}

// PUT /api/attendance/record/:id - admin. Update a record's status.
async function updateRecord(req, res, next) {
  try {
    const existing = await prisma.attendanceRecord.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) return res.status(404).json({ message: 'Record not found' });

    const { status, participant, timeIn } = req.body;
    const data = {};
    if (status !== undefined) data.status = status;
    if (participant !== undefined) data.participant = participant;
    if (timeIn !== undefined) data.timeIn = timeIn ? new Date(timeIn) : null;

    const record = await prisma.attendanceRecord.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ record });
  } catch (err) {
    next(err);
  }
}

const STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

// POST /api/attendance/event/:eventId/manual - admin. { userId } (an official's account)
// or { participant } (a name), plus status and optional timeIn. Recorded as Manual.
async function addManualRecord(req, res, next) {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.eventId }, select: { id: true } });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    const status = STATUSES.includes(req.body.status) ? req.body.status : 'PRESENT';
    let participant = String(req.body.participant || '').trim();
    let userId = null;
    if (req.body.userId) {
      const u = await prisma.user.findUnique({ where: { id: String(req.body.userId) }, select: { id: true, name: true } });
      if (!u) return res.status(404).json({ message: 'Account not found' });
      userId = u.id;
      participant = u.name;
      const already = await prisma.attendanceRecord.findFirst({ where: { eventId: event.id, userId } });
      if (already) return res.status(409).json({ message: `${u.name} already has attendance for this event` });
    }
    if (!participant) return res.status(400).json({ message: 'Choose an official or type a name' });
    const timeIn = req.body.timeIn ? new Date(req.body.timeIn) : ['PRESENT', 'LATE'].includes(status) ? new Date() : null;
    const record = await prisma.attendanceRecord.create({
      data: { eventId: event.id, userId, participant: participant.slice(0, 120), status, timeIn, method: 'MANUAL' },
    });
    res.status(201).json({ record });
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/summary/:eventId - SK side. Tally by status.
async function getEventSummary(req, res, next) {
  try {
    const grouped = await prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { eventId: req.params.eventId },
      _count: { _all: true },
    });
    const summary = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    grouped.forEach((g) => {
      summary[g.status] = g._count._all;
    });
    summary.total = Object.values(summary).reduce((a, b) => a + b, 0);
    res.json({ summary });
  } catch (err) {
    next(err);
  }
}

// ---------- Attendance QR (SK Chairperson) ----------
// Each event has its own QR code: a random token that only works inside the window the
// SK Chairperson sets (at least 10 minutes). Deactivating stops it; regenerating gives a
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
    lateAfterMin: settings.lateAfterMin,
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

// POST /api/attendance/checkin - anyone signed in. { eventId, token } from the scanned QR.
// Within the late threshold after the start: Present; later: Late. Once per event.
async function checkIn(req, res, next) {
  try {
    const { eventId } = req.body;
    const token = req.body.token ?? req.body.code;
    const event = eventId ? await loadEvent(String(eventId)) : null;
    if (!event) return res.status(404).json({ code: 'NOT_FOUND', message: 'This event was not found.' });
    const info = publicEvent(event);

    if (!event.qrToken || !sameToken(token, event.qrToken)) {
      return res.status(400).json({
        code: 'INVALID',
        event: info,
        message: 'This QR code is no longer valid. A new code was made for this event; scan the one on the screen.',
      });
    }
    if (!event.qrActive) {
      return res.status(400).json({ code: 'DEACTIVATED', event: info, message: 'This QR code was deactivated by the SK Chairperson.' });
    }
    const now = Date.now();
    if (event.qrValidFrom && now < new Date(event.qrValidFrom).getTime()) {
      return res.status(400).json({ code: 'NOT_OPEN', event: info, opensAt: event.qrValidFrom, message: 'This QR code is not open yet.' });
    }
    if (event.qrValidUntil && now > new Date(event.qrValidUntil).getTime()) {
      return res.status(400).json({ code: 'EXPIRED', event: info, message: 'This QR code has expired.' });
    }

    const already = await prisma.attendanceRecord.findFirst({ where: { eventId: event.id, userId: req.user.id } });
    if (already) {
      return res.status(409).json({
        code: 'ALREADY',
        event: info,
        record: already,
        message: 'Your attendance for this event was already recorded.',
      });
    }

    const { lateAfterMin } = await getSettings();
    const start = new Date(event.startAt).getTime();
    try {
      const record = await prisma.attendanceRecord.create({
        data: {
          eventId: event.id,
          userId: req.user.id,
          participant: req.user.name,
          status: now > start + lateAfterMin * MIN ? 'LATE' : 'PRESENT',
          timeIn: new Date(now),
          method: 'QR',
        },
      });
      res.status(201).json({ record, event: info });
    } catch (err) {
      // Two scans at the same moment: the second one hits the one-per-event rule.
      if (err.code === 'P2002') {
        return res.status(409).json({ code: 'ALREADY', event: info, message: 'Your attendance for this event was already recorded.' });
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
  checkIn,
  getEventAttendance,
  updateRecord,
  addManualRecord,
  getEventSummary,
};
