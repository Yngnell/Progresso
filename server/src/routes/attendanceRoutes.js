const express = require('express');
const router = express.Router();

const {
  getEventAttendance,
  getEventSummary,
  getQrCode,
  generateQr,
  updateQr,
  getAttendancePage,
  markPresent,
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/auth');
const { requireSkAdmin, requireSkSide } = require('../utils/roles');

// Reading attendance: the SK Admin (not the Barangay Chairman). Nobody records it by
// hand: officials pick their name on the QR page (Present), and Absent is recorded
// automatically once the meeting is over.
router.get('/event/:eventId', protect, requireSkSide, getEventAttendance);
router.get('/summary/:eventId', protect, requireSkSide, getEventSummary);

// Attendance QR: only the SK Admin generates, shows, deactivates, regenerates it and sets
// when it is available.
router.get('/qr/:eventId', protect, requireSkAdmin, getQrCode);
router.post('/qr/:eventId', protect, requireSkAdmin, generateQr);
router.put('/qr/:eventId', protect, requireSkAdmin, updateQr);

// The page the QR code opens (no login): the list of names, and marking one present.
router.get('/public/:eventId', getAttendancePage);
router.post('/public/:eventId', markPresent);

module.exports = router;
