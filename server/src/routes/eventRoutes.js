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
const { photoUpload } = require('../middleware/upload');
const { addEventPhotos } = require('../controllers/photoController');

// Public
router.get('/', getEvents);
router.get('/:id', getEvent);

// Admin only
router.post('/', protect, restrictTo('ADMIN'), createEvent);
router.put('/:id', protect, restrictTo('ADMIN'), updateEvent);
router.delete('/:id', protect, restrictTo('ADMIN'), deleteEvent);
router.post('/:id/photos', protect, restrictTo('ADMIN'), photoUpload, addEventPhotos);

module.exports = router;
