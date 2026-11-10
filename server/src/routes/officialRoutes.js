const express = require('express');
const router = express.Router();

const {
  getOfficials,
  getOfficial,
  createOfficial,
  updateOfficial,
} = require('../controllers/officialController');
const { protect, restrictTo } = require('../middleware/auth');
const { requireSkAdmin } = require('../utils/roles');

// Public
router.get('/', getOfficials);
router.get('/:id', getOfficial);

// Adding: the SK Admin and the officials. Editing: the SK Admin account only.
router.post('/', protect, restrictTo('ADMIN'), createOfficial);
router.put('/:id', protect, requireSkAdmin, updateOfficial);

module.exports = router;
