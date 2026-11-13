const prisma = require('../prisma');
const { getSettings } = require('../utils/settings');
const { photoPath, removePhotoFile } = require('../middleware/upload');

// What the browser gets (the stored file name stays on the server).
function publicSettings(s) {
  return {
    barangayName: s.barangayName,
    skTerm: s.skTerm,
    hasLogo: Boolean(s.logoFile),
    logoVersion: s.logoFile ? new Date(s.updatedAt).getTime() : null,
    qrDefaultBeforeMin: s.qrDefaultBeforeMin,
    qrDefaultLengthMin: s.qrDefaultLengthMin,
  };
}

// GET /api/settings — public: the SK name, term and logo are printed on reports.
async function readSettings(req, res, next) {
  try {
    res.json({ settings: publicSettings(await getSettings()) });
  } catch (err) {
    next(err);
  }
}

function wholeMinutes(value, { min, max, label, allowEmpty = false }) {
  if (allowEmpty && (value === null || value === '' || value === undefined)) return { value: null };
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    return { error: `${label} must be a whole number from ${min} to ${max} minutes` };
  }
  return { value: n };
}

// PUT /api/settings — SK Admin. SK information and attendance defaults.
async function saveSettings(req, res, next) {
  try {
    const b = req.body;
    const data = {};
    if (b.barangayName !== undefined) {
      const v = String(b.barangayName).trim();
      if (!v) return res.status(400).json({ message: 'The barangay name is required' });
      data.barangayName = v.slice(0, 150);
    }
    if (b.skTerm !== undefined) {
      const v = String(b.skTerm).trim();
      if (!/^\d{4}\s*[-–]\s*\d{4}$/.test(v)) {
        return res.status(400).json({ message: 'Write the SK term like 2023-2026' });
      }
      data.skTerm = v.replace(/\s*[-–]\s*/, '-');
    }
    const checks = [
      ['qrDefaultBeforeMin', { min: 0, max: 240, label: 'Opening time before the event' }],
      ['qrDefaultLengthMin', { min: 10, max: 1440, label: 'QR validity', allowEmpty: true }],
    ];
    for (const [key, opts] of checks) {
      if (b[key] === undefined) continue;
      const r = wholeMinutes(b[key], opts);
      if (r.error) return res.status(400).json({ message: r.error });
      data[key] = r.value;
    }
    await getSettings();
    const s = await prisma.setting.update({ where: { id: 'sk' }, data });
    res.json({ settings: publicSettings(s) });
  } catch (err) {
    next(err);
  }
}

// POST /api/settings/logo — SK Admin. multipart "logo". Printed on the PDF exports.
async function uploadLogo(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose a logo to upload' });
    const old = (await getSettings()).logoFile;
    const s = await prisma.setting.update({
      where: { id: 'sk' },
      data: { logoFile: req.file.filename, logoType: req.file.mimetype },
    });
    if (old) removePhotoFile(old);
    res.json({ settings: publicSettings(s) });
  } catch (err) {
    if (req.file) removePhotoFile(req.file.filename);
    next(err);
  }
}

// DELETE /api/settings/logo — back to the SK seal.
async function removeLogo(req, res, next) {
  try {
    const old = (await getSettings()).logoFile;
    const s = await prisma.setting.update({ where: { id: 'sk' }, data: { logoFile: null, logoType: null } });
    if (old) removePhotoFile(old);
    res.json({ settings: publicSettings(s) });
  } catch (err) {
    next(err);
  }
}

// GET /api/settings/logo — the uploaded logo (404 means: use the SK seal /logo.jpg).
async function getLogo(req, res, next) {
  try {
    const s = await getSettings();
    if (!s.logoFile) return res.status(404).json({ message: 'No logo uploaded' });
    res.set('Cache-Control', 'public, max-age=86400');
    if (s.logoType) res.type(s.logoType);
    res.sendFile(photoPath(s.logoFile), (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'Logo file is missing' });
    });
  } catch (err) {
    next(err);
  }
}

// ---------- SK officials list (SK Admin) ----------
// The names in the attendance dropdown and on the public Officials page. The SK officials
// have no login accounts; the SK Admin adds, renames and sets them inactive here.

const OFFICIAL_FIELDS = { id: true, name: true, position: true, isActive: true, displayOrder: true, photoFile: true, updatedAt: true };

// What the client needs about the photo: whether there is one, and a version for the cache.
// The stored file name stays on the server.
function officialOut({ photoFile, updatedAt, ...o }) {
  return { ...o, hasPhoto: Boolean(photoFile), photoVersion: new Date(updatedAt).getTime() };
}

// GET /api/settings/officials — the SK officials.
async function listOfficials(req, res, next) {
  try {
    const officials = await prisma.official.findMany({
      select: OFFICIAL_FIELDS,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ officials: officials.map(officialOut) });
  } catch (err) {
    next(err);
  }
}

// Reads { name, position } from the body; both are required when `required` is set.
function officialData(body, required) {
  const data = {};
  for (const key of ['name', 'position']) {
    if (body[key] === undefined) {
      if (required) return { error: 'Name and position are required' };
      continue;
    }
    const v = String(body[key]).trim();
    if (!v) return { error: `The ${key} is required` };
    data[key] = v.slice(0, 80);
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  return { data };
}

// POST /api/settings/officials — { name, position }
async function createOfficial(req, res, next) {
  try {
    const { data, error } = officialData(req.body, true);
    if (error) return res.status(400).json({ message: error });
    data.displayOrder = await prisma.official.count();
    const official = await prisma.official.create({ data, select: OFFICIAL_FIELDS });
    res.status(201).json({ official: officialOut(official) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/settings/officials/:id — { name?, position?, isActive? }. Officials are never
// deleted (their attendance stays); one who left is set inactive.
async function updateOfficial(req, res, next) {
  try {
    const existing = await prisma.official.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) return res.status(404).json({ message: 'Official not found' });
    const { data, error } = officialData(req.body, false);
    if (error) return res.status(400).json({ message: error });
    const official = await prisma.official.update({ where: { id: existing.id }, data, select: OFFICIAL_FIELDS });
    res.json({ official: officialOut(official) });
  } catch (err) {
    next(err);
  }
}

// POST /api/settings/officials/:id/photo — SK Admin. multipart "photo" (JPG, PNG or WEBP).
async function uploadOfficialPhoto(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose a photo to upload' });
    const existing = await prisma.official.findUnique({ where: { id: req.params.id }, select: { id: true, photoFile: true } });
    if (!existing) {
      removePhotoFile(req.file.filename);
      return res.status(404).json({ message: 'Official not found' });
    }
    const official = await prisma.official.update({
      where: { id: existing.id },
      data: { photoFile: req.file.filename, photoType: req.file.mimetype },
      select: OFFICIAL_FIELDS,
    });
    if (existing.photoFile) removePhotoFile(existing.photoFile);
    res.json({ official: officialOut(official) });
  } catch (err) {
    if (req.file) removePhotoFile(req.file.filename);
    next(err);
  }
}

// DELETE /api/settings/officials/:id/photo — back to the initial.
async function removeOfficialPhoto(req, res, next) {
  try {
    const existing = await prisma.official.findUnique({ where: { id: req.params.id }, select: { id: true, photoFile: true } });
    if (!existing) return res.status(404).json({ message: 'Official not found' });
    const official = await prisma.official.update({
      where: { id: existing.id },
      data: { photoFile: null, photoType: null },
      select: OFFICIAL_FIELDS,
    });
    if (existing.photoFile) removePhotoFile(existing.photoFile);
    res.json({ official: officialOut(official) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  readSettings,
  saveSettings,
  uploadLogo,
  removeLogo,
  getLogo,
  listOfficials,
  createOfficial,
  updateOfficial,
  uploadOfficialPhoto,
  removeOfficialPhoto,
  officialOut,
};
