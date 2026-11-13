const express = require('express');
const router = express.Router();

const { getOfficials, getOfficialPhoto } = require('../controllers/officialController');

// Public, read only (the public Officials page). The list is managed in Settings.
router.get('/', getOfficials);
router.get('/:id/photo', getOfficialPhoto);

module.exports = router;
