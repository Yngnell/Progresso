const express = require('express');
const router = express.Router();

const {
  getEventAttendance,
  markAttendance,
  updateRecord,
  deleteRecord,
  getEventSummary,
  getQrCode,
  checkIn,
} = require('../controllers/attendanceController');
const { protect, restrictTo } = require('../middleware/auth');

// Reading attendance: admin and the chairman. Changing it: admin only.
router.get('/event/:eventId', protect, restrictTo('ADMIN', 'CHAIRMAN'), getEventAttendance);
router.get('/summary/:eventId', protect, restrictTo('ADMIN', 'CHAIRMAN'), getEventSummary);
router.post('/event/:eventId', protect, restrictTo('ADMIN'), markAttendance);

// QR check-in: the admin shows a code that changes every 30 seconds; anyone signed in scans it.
router.get('/qr/:eventId', protect, restrictTo('ADMIN'), getQrCode);
router.post('/checkin', protect, checkIn);
router.put('/record/:id', protect, restrictTo('ADMIN'), updateRecord);
router.delete('/record/:id', protect, restrictTo('ADMIN'), deleteRecord);

module.exports = router;
