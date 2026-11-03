const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { isMailConfigured } = require('../utils/mailer');
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
    photoUrl: user.photoUrl,
    // Set for SK officials: their position from the officials directory
    official: user.official ? { id: user.official.id, position: user.official.position } : null,
    pendingEmail: user.pendingEmail || null,
  };
}

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
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
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
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    res.json({ token: signToken(user), user: publicUser(user) });
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

// PUT /api/auth/profile — update the current user's own profile.
async function updateProfile(req, res, next) {
  try {
    const { name, phone, photoUrl } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (photoUrl !== undefined) data.photoUrl = photoUrl;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
    });

    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// ---------- My Account: change your own login ----------

// PUT /api/auth/password — { currentPassword, newPassword }.
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!(await bcrypt.compare(String(currentPassword || ''), req.user.passwordHash))) {
      return res.status(400).json({ message: 'Your current password is not right' });
    }
    if (String(newPassword || '').length < 8) {
      return res.status(400).json({ message: 'The new password must be at least 8 characters' });
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

const withOfficial = { official: { select: { id: true, position: true } } };

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
};
