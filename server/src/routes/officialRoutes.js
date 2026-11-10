const express = require('express');
const router = express.Router();

const {
  getOfficials,
  getOfficial,
  createOfficial,
  updateOfficial,
} = require('../controllers/officialController');
const { protect } = require('../middleware/auth');
const { requireSkAdmin } = require('../utils/roles');

// Public
router.get('/', getOfficials);
router.get('/:id', getOfficial);

// Adding and editing: the SK Admin account only.
router.post('/', protect, requireSkAdmin, createOfficial);
router.put('/:id', protect, requireSkAdmin, updateOfficial);

module.exports = router;
