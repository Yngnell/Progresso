const express = require('express');
const router = express.Router();

const {
  register,
  login,
  verifyEmail,
  resendCode,
  unsubscribe,
  getMe,
  forgotPassword,
  checkResetToken,
  resetPassword,
  requestPhoneChange,
  requestPasswordChange,
  verifyChange,
  resendChangeCode,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public
router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/resend-code', resendCode);
router.post('/unsubscribe', unsubscribe);

// Forgot password: an emailed one-time link, valid for 15 minutes
router.post('/forgot-password', forgotPassword);
router.get('/reset-password/:token', checkResetToken);
router.post('/reset-password', resetPassword);

// Authenticated
router.get('/me', protect, getMe);

// Settings: the profile picture saves straight away; a new contact number or password is
// saved only after the 6-digit code emailed to the account is entered.
router.post('/phone/request', protect, requestPhoneChange);
router.post('/password/request', protect, requestPasswordChange);
router.post('/verify-change', protect, verifyChange);
router.post('/verify-change/resend', protect, resendChangeCode);

module.exports = router;
