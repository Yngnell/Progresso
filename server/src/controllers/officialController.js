const prisma = require('../prisma');
const { photoPath } = require('../middleware/upload');

// The SK officials' names, positions and photos, read only. They are managed by the SK Admin in
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
      select: { id: true, name: true, position: true, committee: true, termStart: true, termEnd: true, isActive: true, displayOrder: true, photoFile: true, updatedAt: true },
    });
    res.json({
      officials: officials.map(({ photoFile, updatedAt, ...o }) => ({
        ...o,
        hasPhoto: Boolean(photoFile),
        photoVersion: new Date(updatedAt).getTime(),
      })),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/officials/:id/photo — public: an official's photo (404 = show the initial).
async function getOfficialPhoto(req, res, next) {
  try {
    const o = await prisma.official.findUnique({ where: { id: req.params.id }, select: { photoFile: true, photoType: true } });
    if (!o?.photoFile) return res.status(404).json({ message: 'No photo' });
    res.set('Cache-Control', 'public, max-age=86400');
    if (o.photoType) res.type(o.photoType);
    res.sendFile(photoPath(o.photoFile), (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'The photo is missing' });
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getOfficials, getOfficialPhoto };
