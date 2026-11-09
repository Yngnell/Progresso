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
  uploadAvatar,
  removeAvatar,
  getAvatar,
  changePassword,
  changeEmail,
  confirmEmailChange,
  resendEmailChangeCode,
  cancelEmailChange,
  forgotPassword,
  checkResetToken,
  resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { avatarUpload } = require('../middleware/upload');

// Public
router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/resend-code', resendCode);
router.post('/unsubscribe', unsubscribe);
router.get('/avatar/:id', getAvatar);

// Forgot password: an emailed one-time link, valid for 15 minutes
router.post('/forgot-password', forgotPassword);
router.get('/reset-password/:token', checkResetToken);
router.post('/reset-password', resetPassword);

// Authenticated
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/photo', protect, avatarUpload, uploadAvatar);
router.delete('/photo', protect, removeAvatar);

// Settings: anyone signed in can change their own login
router.put('/password', protect, changePassword);
router.put('/email', protect, changeEmail);
router.post('/email/confirm', protect, confirmEmailChange);
router.post('/email/resend', protect, resendEmailChangeCode);
router.delete('/email', protect, cancelEmailChange);

module.exports = router;
