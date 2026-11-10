const express = require('express');
const router = express.Router();

const {
  getEventAttendance,
  getEventSummary,
  getQrCode,
  generateQr,
  updateQr,
  checkIn,
} = require('../controllers/attendanceController');
const { protect, restrictTo } = require('../middleware/auth');
const { requireQrHolder, staffOrQrHolder } = require('../utils/qrHolder');

// Reading attendance: the SK side (admin, chairman, officials). Nobody records it by hand:
// scanning the QR records Present, and Absent is recorded automatically once the event is over.
router.get('/event/:eventId', protect, staffOrQrHolder, getEventAttendance);
router.get('/summary/:eventId', protect, restrictTo('ADMIN', 'CHAIRMAN', 'OFFICIAL'), getEventSummary);

// Attendance QR: only the SK Chairperson (Sehj Miranda) generates, shows, deactivates or
// regenerates an event's code; anyone signed in scans it.
router.get('/qr/:eventId', protect, requireQrHolder, getQrCode);
router.post('/qr/:eventId', protect, requireQrHolder, generateQr);
router.put('/qr/:eventId', protect, requireQrHolder, updateQr);
router.post('/checkin', protect, checkIn);

module.exports = router;
