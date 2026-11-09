const express = require('express');
const router = express.Router();

const { getStats } = require('../controllers/statsController');
const { protect, restrictTo } = require('../middleware/auth');

// Dashboard stats: the SK side (admin, chairman, officials).
router.get('/', protect, restrictTo('ADMIN', 'CHAIRMAN', 'OFFICIAL'), getStats);

module.exports = router;
