const prisma = require('../prisma');
const { makeCode, verifyCode } = require('../utils/checkinCode');

// GET /api/attendance/event/:eventId - list attendance for an event (admin).
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

// POST /api/attendance/event/:eventId - admin.
// Accepts a single record OR an array of records (bulk marking).
async function markAttendance(req, res, next) {
  try {
    const { eventId } = req.params;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const body = Array.isArray(req.body) ? req.body : [req.body];

    for (const r of body) {
      if (!r.participant) {
        return res.status(400).json({ message: 'Each record needs a participant name' });
      }
    }

    const created = await prisma.$transaction(
      body.map((r) =>
        prisma.attendanceRecord.create({
          data: {
            eventId,
            participant: r.participant,
            status: r.status || 'PRESENT',
            userId: r.userId || null,
            timeIn: r.timeIn ? new Date(r.timeIn) : undefined,
          },
        })
      )
    );

    res.status(201).json({ records: created });
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

// DELETE /api/attendance/record/:id - admin.
async function deleteRecord(req, res, next) {
  try {
    const existing = await prisma.attendanceRecord.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) return res.status(404).json({ message: 'Record not found' });
    await prisma.attendanceRecord.delete({ where: { id: req.params.id } });
    res.json({ message: 'Record deleted' });
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/summary/:eventId - admin. Tally by status.
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

// ---------- QR check-in ----------

const MIN = 60 * 1000;
const OPENS_BEFORE = 30 * MIN; // scanning opens 30 minutes before the start
const LATE_AFTER = 15 * MIN; // later than 15 minutes after the start counts as Late
const DEFAULT_LENGTH = 3 * 60 * MIN; // events without an end close 3 hours after the start

function checkinWindow(event) {
  const start = new Date(event.startAt).getTime();
  const end = event.endAt ? new Date(event.endAt).getTime() : start + DEFAULT_LENGTH;
  return { start, opens: start - OPENS_BEFORE, closes: end };
}

// GET /api/attendance/qr/:eventId - admin. The code for the QR shown on screen right now.
async function getQrCode(req, res, next) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      select: { id: true, title: true, startAt: true, endAt: true, location: true },
    });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    const { opens, closes } = checkinWindow(event);
    res.json({ ...makeCode(event.id), event, opensAt: new Date(opens), closesAt: new Date(closes) });
  } catch (err) {
    next(err);
  }
}

// POST /api/attendance/checkin - any signed-in user. { eventId, code } from the scanned QR.
async function checkIn(req, res, next) {
  try {
    const { eventId, code } = req.body;
    const event = eventId
      ? await prisma.event.findUnique({
          where: { id: String(eventId) },
          select: { id: true, title: true, startAt: true, endAt: true, location: true },
        })
      : null;
    if (!event) return res.status(404).json({ code: 'NOT_FOUND', message: 'This meeting was not found.' });

    const now = Date.now();
    const { start, opens, closes } = checkinWindow(event);
    if (now < opens) {
      return res.status(400).json({ code: 'NOT_OPEN', event, opensAt: new Date(opens), message: 'Check-in is not open yet.' });
    }
    if (now > closes) {
      return res.status(400).json({ code: 'CLOSED', event, message: 'Check-in for this meeting is closed.' });
    }
    if (!verifyCode(event.id, code, now)) {
      return res.status(400).json({ code: 'EXPIRED', event, message: 'This code has expired. Scan the code on the screen again.' });
    }

    const already = await prisma.attendanceRecord.findFirst({
      where: { eventId: event.id, userId: req.user.id },
    });
    if (already) return res.json({ already: true, record: already, event });

    const record = await prisma.attendanceRecord.create({
      data: {
        eventId: event.id,
        userId: req.user.id,
        participant: req.user.name,
        status: now > start + LATE_AFTER ? 'LATE' : 'PRESENT',
        timeIn: new Date(now),
      },
    });
    res.status(201).json({ record, event });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getQrCode,
  checkIn,
  getEventAttendance,
  markAttendance,
  updateRecord,
  deleteRecord,
  getEventSummary,
};
