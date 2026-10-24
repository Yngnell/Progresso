const prisma = require('../prisma');

// Shared include: organizer, related project, and attendance records.
const includeOpts = {
  organizer: { select: { id: true, name: true, position: true } },
  relatedProject: { select: { id: true, title: true } },
  attendance: { orderBy: { createdAt: 'asc' } },
};

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
    res.json({ events });
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
    res.json({ event });
  } catch (err) {
    next(err);
  }
}

// Normalize event body into Prisma-ready data.
function parseEventBody(body) {
  const {
    title,
    type,
    description,
    startAt,
    endAt,
    location,
    meetingLink,
    organizerId,
    relatedProjectId,
  } = body;

  const data = {};
  if (title !== undefined) data.title = title;
  if (type !== undefined) data.type = type;
  if (description !== undefined) data.description = description;
  if (startAt !== undefined) {
    if (!startAt) return { error: 'Start date/time is required' };
    data.startAt = new Date(startAt);
  }
  if (endAt !== undefined) data.endAt = endAt ? new Date(endAt) : null;
  if (location !== undefined) data.location = location;
  if (meetingLink !== undefined) data.meetingLink = meetingLink;
  if (organizerId !== undefined) data.organizerId = organizerId || null;
  if (relatedProjectId !== undefined) data.relatedProjectId = relatedProjectId || null;
  return { data };
}

// POST /api/events - admin.
async function createEvent(req, res, next) {
  try {
    if (!req.body.title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    const { data, error } = parseEventBody(req.body);
    if (error) return res.status(400).json({ message: error });

    const event = await prisma.event.create({ data, include: includeOpts });
    res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
}

// PUT /api/events/:id - admin.
async function updateEvent(req, res, next) {
  try {
    const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Event not found' });

    const { data, error } = parseEventBody(req.body);
    if (error) return res.status(400).json({ message: error });

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data,
      include: includeOpts,
    });
    res.json({ event });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/events/:id - admin (cascades attendance).
async function deleteEvent(req, res, next) {
  try {
    const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Event not found' });
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getEvents, getEvent, createEvent, updateEvent, deleteEvent };
