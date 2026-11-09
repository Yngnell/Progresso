const crypto = require('crypto');
const { canShowQr } = require('../utils/qrHolder');
const { isSkChair } = require('../utils/roles');
const { passwordError } = require('../utils/password');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { isMailConfigured, sendMail } = require('../utils/mailer');
const { photoPath, removePhotoFile } = require('../middleware/upload');
const {
  startSignup,
  resendSignupCode,
  finishSignup,
  issueCode,
  checkCode,
} = require('../utils/verification');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shape a user object safe to send to the client (never send the password hash).
function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    // Profile picture: served by GET /api/auth/avatar/:id; the version changes on upload
    hasPhoto: Boolean(user.photoUrl),
    photoVersion: user.photoUrl ? new Date(user.updatedAt).getTime() : null,
    // Set for SK officials: their position from the officials directory
    official: user.official ? { id: user.official.id, position: user.official.position } : null,
    // Only the SK Chairperson's account may show the attendance QR code
    canShowQr: canShowQr(user),
    // The SK Chairperson manages checklists, the QR, accounts and the system settings
    isSkChair: isSkChair(user),
    pendingEmail: user.pendingEmail || null,
    // "Last login" in Settings → Security is the login before this session
    lastLoginAt: user.previousLoginAt || null,
  };
}

const withOfficial = { official: { select: { id: true, position: true } } };

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/register — public viewer self-registration.
// With email set up on the server, no account is created yet: a 6-digit code is emailed
// and the account only exists once the code is verified (see verifyEmail). Without it,
// the code could never arrive, so the account is created straight away.
async function register(req, res, next) {
  try {
    const { name, password, phone } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();
    const receiveUpdates = Boolean(req.body.receiveUpdates);

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    const weak = passwordError(password);
    if (weak) return res.status(400).json({ message: weak });
    if (await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    if (isMailConfigured()) {
      try {
        await startSignup({ email, name, phone, passwordHash, receiveUpdates });
      } catch (err) {
        if (err.status === 429) return res.status(429).json({ message: err.message });
        console.error('Verification email failed:', err.message);
        return res.status(502).json({
          message: 'We could not send the verification email. Check the address and try again.',
        });
      }
      return res.status(201).json({ needsVerification: true, email });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash,
        role: 'VIEWER', // public registration is always a viewer
        emailVerifiedAt: new Date(),
        receiveUpdates,
        updatesSince: receiveUpdates ? new Date() : null,
        unsubscribeToken: receiveUpdates ? crypto.randomBytes(24).toString('hex') : null,
      },
    });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/verify-email — { email, code }. A right code creates the account and logs in.
async function verifyEmail(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await finishSignup(email, req.body.code);
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/resend-code — { email }. Always answers the same, so it never reveals
// whether an address has an account.
async function resendCode(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (email && isMailConfigured()) {
      try {
        await resendSignupCode(email);
      } catch (err) {
        if (err.status === 429) return res.status(429).json({ message: err.message });
        console.error('Verification email failed:', err.message);
        return res.status(502).json({ message: 'We could not send the code. Try again later.' });
      }
    }
    res.json({ message: 'If that email is waiting for verification, a new code is on its way.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/unsubscribe — { token }. The "stop these emails" link in every update email.
async function unsubscribe(req, res, next) {
  try {
    const token = String(req.body.token || '');
    if (token.length < 16) return res.status(400).json({ message: 'This link is not valid.' });
    const result = await prisma.user.updateMany({
      where: { unsubscribeToken: token },
      data: { receiveUpdates: false },
    });
    if (result.count === 0) return res.status(400).json({ message: 'This link is not valid.' });
    res.json({ message: 'You will no longer get update emails.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: String(email).trim(), mode: 'insensitive' } },
      include: { official: { select: { id: true, position: true } } },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    // Login history: the login before this one is shown as "last login" in Settings.
    const signedIn = await prisma.user.update({
      where: { id: user.id },
      data: { previousLoginAt: user.lastLoginAt, lastLoginAt: new Date() },
      include: withOfficial,
    });
    res.json({ token: signToken(signedIn), user: publicUser(signedIn) });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me — returns the currently logged-in user.
async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { official: { select: { id: true, position: true } } },
    });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/auth/profile — update the current user's own name and contact number.
// The position is not changed here: only the SK Chairperson changes positions.
async function updateProfile(req, res, next) {
  try {
    const { name, phone } = req.body;

    const data = {};
    if (name !== undefined) {
      const clean = String(name).trim();
      if (!clean) return res.status(400).json({ message: 'Your name is required' });
      data.name = clean.slice(0, 120);
    }
    if (phone !== undefined) {
      const clean = String(phone || '').trim();
      if (clean && !/^[0-9+()\-\s]{7,20}$/.test(clean)) {
        return res.status(400).json({ message: 'Enter a valid contact number, e.g. 0917 123 4567' });
      }
      data.phone = clean || null;
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      include: withOfficial,
    });
    // An official's name in the directory follows their account name.
    if (data.name && user.officialId) {
      await prisma.official.update({ where: { id: user.officialId }, data: { name: data.name } });
    }

    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/photo — multipart "photo": the signed-in user's profile picture.
async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose a picture to upload' });
    const old = req.user.photoUrl;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { photoUrl: req.file.filename },
      include: withOfficial,
    });
    if (old) removePhotoFile(old);
    res.json({ user: publicUser(user) });
  } catch (err) {
    if (req.file) removePhotoFile(req.file.filename);
    next(err);
  }
}

// DELETE /api/auth/photo — remove the profile picture.
async function removeAvatar(req, res, next) {
  try {
    const old = req.user.photoUrl;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { photoUrl: null },
      include: withOfficial,
    });
    if (old) removePhotoFile(old);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/avatar/:id — the picture itself (an <img> cannot send the login token).
async function getAvatar(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { photoUrl: true },
    });
    if (!user?.photoUrl) return res.status(404).json({ message: 'No picture' });
    res.set('Cache-Control', 'public, max-age=86400');
    res.sendFile(photoPath(user.photoUrl), (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'Picture file is missing' });
    });
  } catch (err) {
    next(err);
  }
}

// ---------- Forgot password ----------

const RESET_MINUTES = 15;
const SAME_ANSWER = 'If this email is registered, we sent a reset link.';
const APP_URL = () => (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// POST /api/auth/forgot-password — { email }. Always gives the same answer, so it never
// reveals whether an address has an account. The emailed link works once, for 15 minutes.
async function forgotPassword(req, res, next) {
  try {
    const email = String(req.body.email || '').trim();
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    if (!isMailConfigured()) {
      return res.status(503).json({
        message: 'Password reset by email is not set up yet. Ask the SK Admin to reset your password.',
      });
    }
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, isActive: true },
    });
    // One email a minute per account, so the form cannot be used to flood an inbox.
    const recent = user?.resetTokenSentAt && Date.now() - new Date(user.resetTokenSentAt) < 60 * 1000;
    if (user && !recent) {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetTokenHash: hashToken(token),
          resetTokenExpires: new Date(Date.now() + RESET_MINUTES * 60 * 1000),
          resetTokenSentAt: new Date(),
        },
      });
      const link = `${APP_URL()}/reset-password?token=${token}`;
      try {
        await sendMail({
          to: user.email,
          subject: 'Reset your SK Monitoring password',
          text:
            `Hi ${user.name},\n\nSomeone asked to reset the password of your SK Monitoring account. ` +
            `Open this link to choose a new password:\n\n${link}\n\n` +
            `The link works once and expires in ${RESET_MINUTES} minutes. ` +
            'If you did not ask for this, you can ignore this email; your password stays the same.',
          html:
            `<p>Hi ${escapeHtml(user.name)},</p>` +
            '<p>Someone asked to reset the password of your SK Monitoring account. Click the button to choose a new password.</p>' +
            `<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#1e3a8a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a></p>` +
            `<p>The link works once and expires in ${RESET_MINUTES} minutes.</p>` +
            '<p>If you did not ask for this, you can ignore this email; your password stays the same.</p>',
        });
      } catch (err) {
        console.error('Reset email failed:', err.message);
      }
    }
    res.json({ message: SAME_ANSWER });
  } catch (err) {
    next(err);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Finds the account a reset link belongs to, or explains why the link does not work.
async function userForResetToken(token) {
  if (!token || String(token).length < 32) return { code: 'INVALID' };
  const user = await prisma.user.findUnique({ where: { resetTokenHash: hashToken(token) } });
  if (!user || !user.isActive) return { code: 'INVALID' };
  if (!user.resetTokenExpires || new Date(user.resetTokenExpires) < new Date()) return { code: 'EXPIRED' };
  return { user };
}

const RESET_ERRORS = {
  INVALID: 'This reset link is not valid or was already used.',
  EXPIRED: 'This reset link has expired. Reset links work for 15 minutes.',
};

// GET /api/auth/reset-password/:token — checks a link before the form is shown.
async function checkResetToken(req, res, next) {
  try {
    const { user, code } = await userForResetToken(req.params.token);
    if (!user) return res.status(400).json({ code, message: RESET_ERRORS[code] });
    res.json({ valid: true });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/reset-password — { token, password, confirmPassword }. The link is used up.
async function resetPassword(req, res, next) {
  try {
    const { token, password, confirmPassword } = req.body;
    const { user, code } = await userForResetToken(token);
    if (!user) return res.status(400).json({ code, message: RESET_ERRORS[code] });
    const weak = passwordError(password);
    if (weak) return res.status(400).json({ message: weak });
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ message: 'The two passwords do not match' });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 12),
        resetTokenHash: null,
        resetTokenExpires: null,
      },
    });
    res.json({ message: 'Your password was reset. You can log in with your new password.' });
  } catch (err) {
    next(err);
  }
}

// ---------- My Account: change your own login ----------

// PUT /api/auth/password — { currentPassword, newPassword }.
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!(await bcrypt.compare(String(currentPassword || ''), req.user.passwordHash))) {
      return res.status(400).json({ message: 'Your current password is not right' });
    }
    const weak = passwordError(newPassword);
    if (weak) return res.status(400).json({ message: weak });
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'The two new passwords do not match' });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ message: 'The new password must be different from the current one' });
    }
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) },
    });
    res.json({ message: 'Your password was changed' });
  } catch (err) {
    next(err);
  }
}

// PUT /api/auth/email — { newEmail, password }. With email set up on the server, a code
// is sent to the new address and the change only happens after it is confirmed.
async function changeEmail(req, res, next) {
  try {
    const newEmail = String(req.body.newEmail || '').trim().toLowerCase();
    if (!(await bcrypt.compare(String(req.body.password || ''), req.user.passwordHash))) {
      return res.status(400).json({ message: 'Your password is not right' });
    }
    if (!EMAIL_PATTERN.test(newEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    if (newEmail === req.user.email.toLowerCase()) {
      return res.status(400).json({ message: 'That is already your email' });
    }
    const taken = await prisma.user.findFirst({
      where: { email: { equals: newEmail, mode: 'insensitive' }, NOT: { id: req.user.id } },
    });
    if (taken) return res.status(400).json({ message: 'That email is already used by another account' });

    if (!isMailConfigured()) {
      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { email: newEmail, pendingEmail: null, emailVerifiedAt: new Date() },
        include: withOfficial,
      });
      return res.json({ changed: true, user: publicUser(user) });
    }
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { pendingEmail: newEmail, verifyCodeSentAt: null },
    });
    try {
      await issueCode(user, 'EMAIL_CHANGE', newEmail);
    } catch (err) {
      console.error('Email change code failed:', err.message);
      return res
        .status(502)
        .json({ message: 'We could not send the code to that address. Check it and try again.' });
    }
    res.json({ codeSent: true, pendingEmail: newEmail });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/email/confirm — { code } sent to the new address.
async function confirmEmailChange(req, res, next) {
  try {
    const me = req.user;
    if (!me.pendingEmail) return res.status(400).json({ message: 'There is no email change waiting' });
    await checkCode(me, 'EMAIL_CHANGE', req.body.code);
    const taken = await prisma.user.findFirst({
      where: { email: { equals: me.pendingEmail, mode: 'insensitive' }, NOT: { id: me.id } },
    });
    if (taken) {
      await prisma.user.update({ where: { id: me.id }, data: { pendingEmail: null } });
      return res.status(400).json({ message: 'That email is already used by another account' });
    }
    const user = await prisma.user.update({
      where: { id: me.id },
      data: { email: me.pendingEmail, pendingEmail: null, emailVerifiedAt: new Date() },
      include: withOfficial,
    });
    res.json({ changed: true, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/email/resend — a new code for the waiting email change.
async function resendEmailChangeCode(req, res, next) {
  try {
    if (!req.user.pendingEmail) return res.status(400).json({ message: 'There is no email change waiting' });
    try {
      await issueCode(req.user, 'EMAIL_CHANGE', req.user.pendingEmail);
    } catch (err) {
      if (err.status === 429) return res.status(429).json({ message: err.message });
      return res.status(502).json({ message: 'We could not send the code. Try again later.' });
    }
    res.json({ codeSent: true });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/auth/email — cancel a waiting email change.
async function cancelEmailChange(req, res, next) {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { pendingEmail: null, verifyCodeHash: null, verifyCodeExpires: null, verifyCodeFor: null },
    });
    res.json({ message: 'Email change cancelled' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  changePassword,
  changeEmail,
  confirmEmailChange,
  resendEmailChangeCode,
  cancelEmailChange,
  register,
  login,
  verifyEmail,
  resendCode,
  unsubscribe,
  getMe,
  updateProfile,
  uploadAvatar,
  removeAvatar,
  getAvatar,
  forgotPassword,
  checkResetToken,
  resetPassword,
};
