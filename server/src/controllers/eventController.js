const prisma = require('../prisma');
const { parsePhDate } = require('../utils/phTime');

// Shared include: organizer, related project, and attendance records.
const includeOpts = {
  organizer: { select: { id: true, name: true, position: true } },
  relatedProject: { select: { id: true, title: true } },
  attendance: { orderBy: { createdAt: 'asc' } },
};

// The attendance QR token is a secret: only the SK Admin gets it (attendance/qr).
function hideQr(event) {
  if (!event) return event;
  const { qrToken, ...rest } = event;
  return rest;
}

// GET /api/events - public. Optional ?type= and ?upcoming=true filters.
async function getEvents(req, res, next) {
  try {
    const { type, upcoming } = req.query;
    const where = {};
    if (type) where.type = type;
    if (upcoming === 'true') where.startAt = { gte: new Date() };

    const events = await prisma.event.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: includeOpts,
    });
    res.json({ events: events.map(hideQr) });
  } catch (err) {
    next(err);
  }
}

// GET /api/events/:id - public.
async function getEvent(req, res, next) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: includeOpts,
    });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json({ event: hideQr(event) });
  } catch (err) {
    next(err);
  }
}

// Meetings only: every new or edited event is a Meeting, named "Meeting" unless a title is given.
const MEETING = 'MEETING';
const MEETING_TITLE = 'Meeting';

// A meeting is finished once its end (or, without an end, its start) has passed. Finished
// meetings can no longer be edited or deleted.
const finished = (event, now = new Date()) => new Date(event.endAt || event.startAt) <= now;
const FINISHED_MESSAGE = 'This meeting has already ended and can no longer be changed';
// What an existing meeting may still change. Meetings are never deleted (their attendance stays).
const EDITABLE_FIELDS = ['endAt', 'meetingLink', 'relatedProjectId'];

// A meeting can be linked to an Approved or Ongoing project (shown on the calendar; its
// attendance counts toward the project's participants in Form 8). Returns an error or null.
async function checkProjectLink(projectId) {
  if (!projectId) return null;
  const project = await prisma.project.findUnique({ where: { id: String(projectId) }, select: { status: true, archivedAt: true } });
  if (!project || project.archivedAt || !['APPROVED', 'ONGOING'].includes(project.status)) {
    return 'Link the meeting to an approved or ongoing project';
  }
  return null;
}

// Normalize event body into Prisma-ready data. Start and end must not be in the past,
// and the end must be after the start.
function parseEventBody(body, existing = {}) {
  const {
    title,
    description,
    startAt,
    endAt,
    location,
    meetingLink,
    organizerId,
    relatedProjectId,
  } = body;

  const data = { type: MEETING };
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (startAt !== undefined) {
    if (!startAt) return { error: 'Start date/time is required' };
    data.startAt = parsePhDate(startAt);
  }
  if (endAt !== undefined) data.endAt = endAt ? parsePhDate(endAt) : null;
  const now = new Date();
  for (const key of ['startAt', 'endAt']) {
    if (data[key] && Number.isNaN(data[key].getTime())) return { error: 'Enter a valid date and time' };
    if (data[key] && data[key] < now) return { error: 'The date and time cannot be in the past' };
  }
  const start = data.startAt || existing.startAt;
  const end = data.endAt !== undefined ? data.endAt : existing.endAt;
  if (start && end && new Date(end) <= new Date(start)) {
    return { error: 'The end date and time must be after the start' };
  }
  if (location !== undefined) data.location = location;
  if (meetingLink !== undefined) data.meetingLink = meetingLink;
  if (organizerId !== undefined) data.organizerId = organizerId || null;
  if (relatedProjectId !== undefined) data.relatedProjectId = relatedProjectId || null;
  return { data };
}

// POST /api/events - admin.
async function createEvent(req, res, next) {
  try {
    const { data, error } = parseEventBody(req.body);
    if (error) return res.status(400).json({ message: error });
    if (!data.startAt) return res.status(400).json({ message: 'Start date/time is required' });
    if (!data.title) data.title = MEETING_TITLE;
    const linkError = await checkProjectLink(data.relatedProjectId);
    if (linkError) return res.status(400).json({ message: linkError });

    const event = await prisma.event.create({ data, include: includeOpts });
    res.status(201).json({ event: hideQr(event) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/events/:id - admin.
async function updateEvent(req, res, next) {
  try {
    const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Event not found' });

    if (finished(existing)) return res.status(400).json({ message: FINISHED_MESSAGE });

    // Only the end time and the meeting link of a meeting can be changed.
    const extra = Object.keys(req.body || {}).filter((k) => !EDITABLE_FIELDS.includes(k));
    if (extra.length > 0) {
      return res.status(400).json({ message: 'Only the end time, the meeting link and the project of a meeting can be changed' });
    }
    const body = {};
    EDITABLE_FIELDS.forEach((k) => {
      if (req.body[k] !== undefined) body[k] = req.body[k];
    });
    const { data, error } = parseEventBody(body, existing);
    if (error) return res.status(400).json({ message: error });
    const linkError = await checkProjectLink(data.relatedProjectId);
    if (linkError) return res.status(400).json({ message: linkError });

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data,
      include: includeOpts,
    });
    // The meeting's attendance follows its project link.
    if (data.relatedProjectId !== undefined && data.relatedProjectId !== existing.relatedProjectId) {
      await prisma.attendanceRecord.updateMany({ where: { eventId: existing.id }, data: { projectId: data.relatedProjectId } });
    }
    res.json({ event: hideQr(event) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/events/:id - admin (cascades attendance).


module.exports = { getEvents, getEvent, createEvent, updateEvent };
