const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { getSettings } = require('../utils/settings');
const { photoPath, removePhotoFile } = require('../middleware/upload');
const { passwordError } = require('../utils/password');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// What the browser gets (the stored file name stays on the server).
function publicSettings(s) {
  return {
    barangayName: s.barangayName,
    skTerm: s.skTerm,
    hasLogo: Boolean(s.logoFile),
    logoVersion: s.logoFile ? new Date(s.updatedAt).getTime() : null,
    qrDefaultBeforeMin: s.qrDefaultBeforeMin,
    qrDefaultLengthMin: s.qrDefaultLengthMin,
    lateAfterMin: s.lateAfterMin,
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

// PUT /api/settings — SK Chairperson. SK information and attendance defaults.
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
      ['lateAfterMin', { min: 0, max: 240, label: 'Late threshold' }],
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

// POST /api/settings/logo — SK Chairperson. multipart "logo". Printed on the PDF exports.
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

// ---------- User management (SK Chairperson) ----------

const ACCOUNT_FIELDS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  official: { select: { id: true, position: true } },
};

// GET /api/settings/accounts — the SK officials' accounts, plus the SK Admin account(s)
// and the official each one acts as.
async function listAccounts(req, res, next) {
  try {
    const [accounts, admins] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'OFFICIAL' },
        select: ACCOUNT_FIELDS,
        orderBy: [{ official: { displayOrder: 'asc' } }, { name: 'asc' }],
      }),
      prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true, name: true, email: true, isActive: true, actsAsOfficialId: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    res.json({ accounts, admins });
  } catch (err) {
    next(err);
  }
}

// PUT /api/settings/admins/:id — { officialId } (or null). The SK Admin account acts as
// that official: the header shows the official's name and position.
async function setAdminOfficial(req, res, next) {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true } });
    if (!admin || admin.role !== 'ADMIN') return res.status(404).json({ message: 'Admin account not found' });
    let officialId = req.body.officialId ? String(req.body.officialId) : null;
    if (officialId) {
      const official = await prisma.official.findUnique({ where: { id: officialId }, select: { id: true } });
      if (!official) return res.status(404).json({ message: 'Official not found' });
    }
    const updated = await prisma.user.update({
      where: { id: admin.id },
      data: { actsAsOfficialId: officialId },
      select: { id: true, name: true, email: true, isActive: true, actsAsOfficialId: true },
    });
    res.json({ admin: updated });
  } catch (err) {
    next(err);
  }
}

// POST /api/settings/accounts — { name, email, position, password }. Creates the official
// in the directory and their own login.
async function createAccount(req, res, next) {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const position = String(req.body.position || '').trim();
    const { password } = req.body;
    if (!name || !position) return res.status(400).json({ message: 'Name and position are required' });
    if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ message: 'Please enter a valid email address' });
    const weak = passwordError(password);
    if (weak) return res.status(400).json({ message: weak });
    if (await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })) {
      return res.status(400).json({ message: 'That email is already used by another account' });
    }
    const count = await prisma.official.count();
    const account = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role: 'OFFICIAL',
        emailVerifiedAt: new Date(),
        official: { create: { name, position: position.slice(0, 80), displayOrder: count } },
      },
      select: ACCOUNT_FIELDS,
    });
    res.status(201).json({ account });
  } catch (err) {
    next(err);
  }
}

// PUT /api/settings/accounts/:id — { position } and/or { isActive }.
async function updateAccount(req, res, next) {
  try {
    const account = await prisma.user.findUnique({ where: { id: req.params.id }, select: ACCOUNT_FIELDS });
    if (!account || account.role !== 'OFFICIAL') return res.status(404).json({ message: 'Account not found' });

    const { position, isActive } = req.body;
    if (isActive !== undefined) {
      if (account.id === req.user.id && !isActive) {
        return res.status(400).json({ message: 'You cannot deactivate your own account' });
      }
      await prisma.user.update({ where: { id: account.id }, data: { isActive: Boolean(isActive) } });
      if (account.official) {
        await prisma.official.update({ where: { id: account.official.id }, data: { isActive: Boolean(isActive) } });
      }
    }
    if (position !== undefined) {
      const p = String(position).trim();
      if (!p) return res.status(400).json({ message: 'The position is required' });
      // Someone must keep the SK Chairperson's rights: you cannot change your own position.
      if (account.id === req.user.id) {
        return res.status(400).json({ message: 'You cannot change your own position' });
      }
      if (account.official) {
        await prisma.official.update({ where: { id: account.official.id }, data: { position: p.slice(0, 80) } });
      } else {
        await prisma.user.update({
          where: { id: account.id },
          data: { official: { create: { name: account.name, position: p.slice(0, 80) } } },
        });
      }
    }
    const updated = await prisma.user.findUnique({ where: { id: account.id }, select: ACCOUNT_FIELDS });
    res.json({ account: updated });
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
  listAccounts,
  createAccount,
  updateAccount,
  setAdminOfficial,
};
