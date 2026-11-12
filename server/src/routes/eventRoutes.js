const express = require('express');
const router = express.Router();

const {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
} = require('../controllers/eventController');
const { protect, restrictTo } = require('../middleware/auth');

// Public
router.get('/', getEvents);
router.get('/:id', getEvent);

// Admin only. Meetings are never deleted; an existing meeting may only change its end time
// and meeting link.
router.post('/', protect, restrictTo('ADMIN'), createEvent);
router.put('/:id', protect, restrictTo('ADMIN'), updateEvent);

module.exports = router;
