const prisma = require('../prisma');

// GET /api/officials — public list. Optional ?active=true/false filter.
async function getOfficials(req, res, next) {
  try {
    const { active } = req.query;
    const where = {};
    if (active === 'true') where.isActive = true;
    else if (active === 'false') where.isActive = false;

    const officials = await prisma.official.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ officials });
  } catch (err) {
    next(err);
  }
}

// GET /api/officials/:id
async function getOfficial(req, res, next) {
  try {
    const official = await prisma.official.findUnique({ where: { id: req.params.id } });
    if (!official) return res.status(404).json({ message: 'Official not found' });
    res.json({ official });
  } catch (err) {
    next(err);
  }
}

// POST /api/officials — admin
async function createOfficial(req, res, next) {
  try {
    const { name, position, committee, contact, termStart, termEnd, photoUrl, bio, displayOrder, isActive } = req.body;
    if (!name || !position) {
      return res.status(400).json({ message: 'Name and position are required' });
    }
    const official = await prisma.official.create({
      data: {
        name,
        position,
        committee,
        contact,
        photoUrl,
        bio,
        termStart: termStart ? new Date(termStart) : null,
        termEnd: termEnd ? new Date(termEnd) : null,
        displayOrder: displayOrder != null ? Number(displayOrder) : 0,
        isActive: isActive != null ? Boolean(isActive) : true,
      },
    });
    res.status(201).json({ official });
  } catch (err) {
    next(err);
  }
}

// PUT /api/officials/:id — admin
async function updateOfficial(req, res, next) {
  try {
    const existing = await prisma.official.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Official not found' });

    const { name, position, committee, contact, termStart, termEnd, photoUrl, bio, displayOrder, isActive } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (position !== undefined) data.position = position;
    if (committee !== undefined) data.committee = committee;
    if (contact !== undefined) data.contact = contact;
    if (termStart !== undefined) data.termStart = termStart ? new Date(termStart) : null;
    if (termEnd !== undefined) data.termEnd = termEnd ? new Date(termEnd) : null;
    if (photoUrl !== undefined) data.photoUrl = photoUrl;
    if (bio !== undefined) data.bio = bio;
    if (displayOrder !== undefined) data.displayOrder = Number(displayOrder);
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const official = await prisma.official.update({ where: { id: req.params.id }, data });
    res.json({ official });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/officials/:id — admin
async function deleteOfficial(req, res, next) {
  try {
    const existing = await prisma.official.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Official not found' });
    await prisma.official.delete({ where: { id: req.params.id } });
    res.json({ message: 'Official deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getOfficials, getOfficial, createOfficial, updateOfficial, deleteOfficial };
