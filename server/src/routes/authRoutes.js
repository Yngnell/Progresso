const express = require('express');
const router = express.Router();

const {
  register,
  login,
  verifyEmail,
  resendCode,
  unsubscribe,
  getMe,
  updateProfile,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public
router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/resend-code', resendCode);
router.post('/unsubscribe', unsubscribe);

// Authenticated
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

module.exports = router;
