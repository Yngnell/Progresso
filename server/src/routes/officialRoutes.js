const express = require('express');
const router = express.Router();

const {
  getOfficials,
  getOfficial,
  createOfficial,
  updateOfficial,
  deleteOfficial,
} = require('../controllers/officialController');
const { protect, restrictTo } = require('../middleware/auth');

// Public
router.get('/', getOfficials);
router.get('/:id', getOfficial);

// Admin only
router.post('/', protect, restrictTo('ADMIN'), createOfficial);
router.put('/:id', protect, restrictTo('ADMIN'), updateOfficial);
router.delete('/:id', protect, restrictTo('ADMIN'), deleteOfficial);

module.exports = router;
