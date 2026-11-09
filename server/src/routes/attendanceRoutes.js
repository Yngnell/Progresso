const express = require('express');
const router = express.Router();

const {
  getEventAttendance,
  updateRecord,
  addManualRecord,
  getEventSummary,
  getQrCode,
  generateQr,
  updateQr,
  checkIn,
} = require('../controllers/attendanceController');
const { protect, restrictTo } = require('../middleware/auth');
const { requireQrHolder, staffOrQrHolder } = require('../utils/qrHolder');

// Reading attendance: the SK side (admin, chairman, officials). Changing it: admin only.
router.get('/event/:eventId', protect, staffOrQrHolder, getEventAttendance);
router.get('/summary/:eventId', protect, restrictTo('ADMIN', 'CHAIRMAN', 'OFFICIAL'), getEventSummary);
router.post('/event/:eventId/manual', protect, restrictTo('ADMIN'), addManualRecord);
router.put('/record/:id', protect, restrictTo('ADMIN'), updateRecord);

// Attendance QR: only the SK Chairperson (Sehj Miranda) generates, shows, deactivates or
// regenerates an event's code; anyone signed in scans it.
router.get('/qr/:eventId', protect, requireQrHolder, getQrCode);
router.post('/qr/:eventId', protect, requireQrHolder, generateQr);
router.put('/qr/:eventId', protect, requireQrHolder, updateQr);
router.post('/checkin', protect, checkIn);

module.exports = router;
