const { isSkChair, isStaff } = require('./roles');

// Only the SK Chairperson's own account (Sehj Miranda) may show the attendance QR code.
// req.user carries the linked official's position (see middleware/auth.js).
const canShowQr = isSkChair;

// Route guard: the QR holder only.
function requireQrHolder(req, res, next) {
  if (canShowQr(req.user)) return next();
  return res.status(403).json({ message: 'Only the SK Chairperson can show the attendance QR code.' });
}

// Route guard: anyone on the SK side (admin, chairman, officials) sees who checked in.
function staffOrQrHolder(req, res, next) {
  if (isStaff(req.user) || canShowQr(req.user)) return next();
  return res.status(403).json({ message: 'Not allowed' });
}

module.exports = { canShowQr, requireQrHolder, staffOrQrHolder };
