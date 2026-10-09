const express = require('express');
const router = express.Router();

const { getStats } = require('../controllers/statsController');
const { protect, restrictTo } = require('../middleware/auth');

// Admin only dashboard stats.
router.get('/', protect, restrictTo('ADMIN'), getStats);

module.exports = router;
