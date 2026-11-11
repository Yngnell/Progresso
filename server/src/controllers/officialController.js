const prisma = require('../prisma');

// The SK officials' names and positions, read only. They are managed by the SK Admin in
// Settings → System (settingsController) and shown on the public Officials page and in
// the attendance dropdown.

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
      select: { id: true, name: true, position: true, committee: true, termStart: true, termEnd: true, isActive: true, displayOrder: true },
    });
    res.json({ officials });
  } catch (err) {
    next(err);
  }
}

module.exports = { getOfficials };
