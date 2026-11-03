const prisma = require('../prisma');

// Only the SK Chairperson's own account (Sehj Miranda) may show the attendance QR code.
// The account is the one linked to the official whose position is "SK Chairperson".
const QR_POSITION = /^sk chairperson$/i;

function canShowQr(user) {
  return Boolean(user?.official && QR_POSITION.test(String(user.official.position || '').trim()));
}

async function loadCanShowQr(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { official: { select: { position: true } } },
  });
  return canShowQr(user);
}

// Route guard: the QR holder only.
async function requireQrHolder(req, res, next) {
  try {
    if (await loadCanShowQr(req.user.id)) return next();
    return res.status(403).json({ message: 'Only the SK Chairperson can show the attendance QR code.' });
  } catch (err) {
    next(err);
  }
}

// Route guard: admin, the barangay chairman, or the QR holder (to see who checked in).
async function staffOrQrHolder(req, res, next) {
  try {
    if (['ADMIN', 'CHAIRMAN'].includes(req.user.role) || (await loadCanShowQr(req.user.id))) return next();
    return res.status(403).json({ message: 'Not allowed' });
  } catch (err) {
    next(err);
  }
}

module.exports = { canShowQr, requireQrHolder, staffOrQrHolder };
