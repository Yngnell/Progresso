const express = require('express');
const router = express.Router();

const {
  listNotifications,
  markRead,
  markAllRead,
} = require('../controllers/notificationController');
const { protect, restrictTo } = require('../middleware/auth');

// Notifications are for the SK side: the admin, the Barangay Chairman and the officials.
// Alerts are also emailed automatically to each SK Admin and Barangay Chairman account's
// registered email (see utils/notifications.js).
router.use(protect, restrictTo('ADMIN', 'CHAIRMAN', 'OFFICIAL'));

router.get('/', listNotifications);
router.put('/read-all', markAllRead); // before '/:id/read'
router.put('/:id/read', markRead);

module.exports = router;
