const express = require('express');
const router = express.Router();

const { getViewers } = require('../controllers/userController');
const { protect, restrictTo } = require('../middleware/auth');

// Admin-only: list registered public viewers.
router.get('/viewers', protect, restrictTo('ADMIN'), getViewers);

module.exports = router;
