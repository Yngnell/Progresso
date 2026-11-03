const express = require('express');
const router = express.Router();

const { deletePhoto, getPhotoFile } = require('../controllers/photoController');
const { protect, restrictTo } = require('../middleware/auth');

// Progress photos: anyone can open the image, only the admin can delete.
router.get('/:id/file', getPhotoFile);
router.delete('/:id', protect, restrictTo('ADMIN'), deletePhoto);

module.exports = router;
