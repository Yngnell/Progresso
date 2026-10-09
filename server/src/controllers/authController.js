const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

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
async function register(req, res, next) {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash: await bcrypt.hash(password, 12),
        role: 'VIEWER', // public registration is always a viewer
      },
    });

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
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

    const user = await prisma.user.findUnique({ where: { email } });
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

module.exports = { register, login, getMe, updateProfile };
