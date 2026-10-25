const express = require('express');
const router = express.Router();

const {
  listNotifications,
  markRead,
  markAllRead,
  getEmailSettings,
  saveEmailSettings,
  sendTestEmail,
  verifyNotifyEmail,
  resendNotifyCode,
} = require('../controllers/notificationController');
const { protect, restrictTo } = require('../middleware/auth');

// Notifications are for the SK admin and the Barangay Chairman.
router.use(protect, restrictTo('ADMIN', 'CHAIRMAN'));

router.get('/', listNotifications);
router.put('/read-all', markAllRead); // before '/:id/read'
router.get('/email-settings', getEmailSettings);
router.put('/email-settings', saveEmailSettings);
router.post('/verify-email', verifyNotifyEmail);
router.post('/resend-code', resendNotifyCode);
router.post('/test-email', sendTestEmail);
router.put('/:id/read', markRead);

module.exports = router;
