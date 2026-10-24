const prisma = require('../prisma');

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

module.exports = {
  getEventAttendance,
  markAttendance,
  updateRecord,
  deleteRecord,
  getEventSummary,
};
