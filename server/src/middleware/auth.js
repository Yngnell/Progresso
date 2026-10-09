const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

// Verifies the Bearer token and attaches the user to req.user.
async function protect(req, res, next) {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized — no token provided' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Not authorized — invalid or expired token' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Not authorized — user no longer exists' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Like protect, but does NOT reject when there is no/invalid token.
// It just attaches req.user when a valid token is present.
// Useful for routes that behave differently for logged-in users (e.g. news feed).
async function optionalAuth(req, res, next) {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return next();

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return next();
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (user && user.isActive) req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Restricts a route to specific roles, e.g. restrictTo('ADMIN').
// Must be used AFTER protect.
function restrictTo(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden — you do not have permission' });
    }
    next();
  };
}

module.exports = { protect, optionalAuth, restrictTo };
