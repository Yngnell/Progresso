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
  changePassword,
  changeEmail,
  confirmEmailChange,
  resendEmailChangeCode,
  cancelEmailChange,
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

// My Account: anyone signed in can change their own login
router.put('/password', protect, changePassword);
router.put('/email', protect, changeEmail);
router.post('/email/confirm', protect, confirmEmailChange);
router.post('/email/resend', protect, resendEmailChangeCode);
router.delete('/email', protect, cancelEmailChange);

module.exports = router;
