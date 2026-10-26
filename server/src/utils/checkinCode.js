const crypto = require('crypto');

// Rotating QR check-in codes. A code is "<window>.<signature>": the window is the current
// 30-second slot and the signature ties it to one event with a server secret, so codes
// need no database table and a photo of the QR stops working a minute later.
const WINDOW_MS = 30 * 1000;

const secret = () => process.env.CHECKIN_SECRET || process.env.JWT_SECRET || 'dev-checkin-secret';

function sign(eventId, window) {
  return crypto
    .createHmac('sha256', secret())
    .update(`${eventId}:${window}`)
    .digest('base64url')
    .slice(0, 16);
}

// The code to show on screen right now, and how long until it changes.
function makeCode(eventId, now = Date.now()) {
  const window = Math.floor(now / WINDOW_MS);
  return { code: `${window}.${sign(eventId, window)}`, expiresInMs: (window + 1) * WINDOW_MS - now };
}

// True when the code belongs to this event and is the current or the previous window
// (someone scanning just as it changes still gets in).
function verifyCode(eventId, code, now = Date.now()) {
  const [w, sig] = String(code || '').split('.');
  const window = Number(w);
  if (!Number.isInteger(window) || !sig) return false;
  const current = Math.floor(now / WINDOW_MS);
  if (window !== current && window !== current - 1) return false;
  const expected = sign(eventId, window);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

module.exports = { makeCode, verifyCode, WINDOW_MS };
