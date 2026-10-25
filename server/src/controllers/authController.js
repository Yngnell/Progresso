const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { isMailConfigured } = require('../utils/mailer');
const { startSignup, resendSignupCode, finishSignup } = require('../utils/verification');

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
    res.json({ user: publicUser(req.user) });
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

module.exports = {
  register,
  login,
  verifyEmail,
  resendCode,
  unsubscribe,
  getMe,
  updateProfile,
};
