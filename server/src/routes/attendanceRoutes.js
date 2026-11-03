const express = require('express');
const router = express.Router();

const {
  getEventAttendance,
  updateRecord,
  getEventSummary,
  getQrCode,
  checkIn,
} = require('../controllers/attendanceController');
const { protect, restrictTo } = require('../middleware/auth');
const { requireQrHolder, staffOrQrHolder } = require('../utils/qrHolder');

// Reading attendance: admin and the chairman. Changing it: admin only.
// The SK Chairperson also sees the live list on the QR screen.
router.get('/event/:eventId', protect, staffOrQrHolder, getEventAttendance);
router.get('/summary/:eventId', protect, restrictTo('ADMIN', 'CHAIRMAN'), getEventSummary);

// QR check-in: only the SK Chairperson (Sehj Miranda) shows the code, which changes every
// 30 seconds; anyone signed in scans it.
router.get('/qr/:eventId', protect, requireQrHolder, getQrCode);
router.post('/checkin', protect, checkIn);
router.put('/record/:id', protect, restrictTo('ADMIN'), updateRecord);

module.exports = router;
