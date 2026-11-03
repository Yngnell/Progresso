const express = require('express');
const router = express.Router();

const {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
} = require('../controllers/eventController');
const { protect, restrictTo } = require('../middleware/auth');

// Public
router.get('/', getEvents);
router.get('/:id', getEvent);

// Admin only
router.post('/', protect, restrictTo('ADMIN'), createEvent);
router.put('/:id', protect, restrictTo('ADMIN'), updateEvent);
router.delete('/:id', protect, restrictTo('ADMIN'), deleteEvent);

module.exports = router;
