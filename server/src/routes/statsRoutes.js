const express = require('express');
const router = express.Router();

const { getStats } = require('../controllers/statsController');
const { protect, restrictTo } = require('../middleware/auth');

// Dashboard stats: admin and the chairman (read-only).
router.get('/', protect, restrictTo('ADMIN', 'CHAIRMAN'), getStats);

module.exports = router;
