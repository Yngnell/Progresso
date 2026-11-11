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

    const { data, error } = parseEventBody(req.body, existing);
    if (error) return res.status(400).json({ message: error });

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data,
      include: includeOpts,
    });
    res.json({ event: hideQr(event) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/events/:id - admin (cascades attendance).
async function deleteEvent(req, res, next) {
  try {
    const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Event not found' });
    if (finished(existing)) return res.status(400).json({ message: FINISHED_MESSAGE });
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getEvents, getEvent, createEvent, updateEvent, deleteEvent };
