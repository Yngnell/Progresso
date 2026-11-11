const express = require('express');
const router = express.Router();

const { dashboardReport, attendanceReport } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { requireSkSide, requireStaff } = require('../utils/roles');

// Data for the PDF and Excel exports: the SK side (admin, chairman, officials).
router.get('/dashboard', protect, requireStaff, dashboardReport);
// The Attendance report: not for the Barangay Chairman (no Attendance module).
router.get('/attendance', protect, requireSkSide, attendanceReport);

module.exports = router;
