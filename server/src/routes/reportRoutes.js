const express = require('express');
const router = express.Router();

const { dashboardReport, attendanceReport } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { requireStaff } = require('../utils/roles');

// Data for the PDF and Excel exports: the SK side (admin, chairman, officials).
router.get('/dashboard', protect, requireStaff, dashboardReport);
router.get('/attendance', protect, requireStaff, attendanceReport);

module.exports = router;
