const prisma = require('../prisma');

// When an event is over, every SK official who did not scan its QR code is recorded as
// Absent (no time in). "Over" means the event has ended and its QR code can no longer be
// scanned. Runs on a timer and before attendance is shown; safe to run any number of
// times, because each official has at most one record per event.

const DEFAULT_LENGTH = 3 * 60 * 60 * 1000; // events without an end time last 3 hours

// The SK officials whose attendance is expected: active official accounts.
function expectedOfficials() {
  return prisma.user.findMany({
    where: { role: 'OFFICIAL', isActive: true },
    select: { id: true, name: true },
  });
}

// When attendance for the event closes: its end, or later if the QR code is still valid.
function closesAt(event) {
  const end = event.endAt ? new Date(event.endAt).getTime() : new Date(event.startAt).getTime() + DEFAULT_LENGTH;
  const qr = event.qrActive && event.qrValidUntil ? new Date(event.qrValidUntil).getTime() : 0;
  return Math.max(end, qr);
}

let lastRun = 0;

// Records the Absent rows. { eventId } checks one event straight away; without it every
// event is checked, at most once every 30 seconds unless force is set.
async function markAbsentees({ eventId, force = false } = {}) {
  const now = Date.now();
  if (!eventId) {
    if (!force && now - lastRun < 30 * 1000) return 0;
    lastRun = now;
  }
  const [events, officials] = await Promise.all([
    prisma.event.findMany({
      where: { startAt: { lte: new Date(now) }, ...(eventId ? { id: eventId } : {}) },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        qrActive: true,
        qrValidUntil: true,
        attendance: { select: { userId: true, participant: true } },
      },
    }),
    expectedOfficials(),
  ]);
  if (officials.length === 0) return 0;

  const rows = [];
  for (const e of events) {
    if (closesAt(e) > now) continue;
    const users = new Set(e.attendance.map((a) => a.userId).filter(Boolean));
    // Older records typed in by name (no account) still count for that official.
    const names = new Set(e.attendance.filter((a) => !a.userId).map((a) => a.participant.trim().toLowerCase()));
    for (const o of officials) {
      if (users.has(o.id) || names.has(o.name.trim().toLowerCase())) continue;
      rows.push({ eventId: e.id, userId: o.id, participant: o.name, status: 'ABSENT', timeIn: null });
    }
  }
  if (rows.length === 0) return 0;
  const result = await prisma.attendanceRecord.createMany({ data: rows, skipDuplicates: true });
  return result.count;
}

module.exports = { markAbsentees, closesAt };
