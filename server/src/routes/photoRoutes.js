const express = require('express');
const router = express.Router();

const { deletePhoto, getPhotoFile } = require('../controllers/photoController');
const { protect } = require('../middleware/auth');

// Pictures: anyone can open the image. The uploader, the SK Chairperson and the admin
// can delete one (checked in deletePhoto).
router.get('/:id/file', getPhotoFile);
router.delete('/:id', protect, deletePhoto);

module.exports = router;
