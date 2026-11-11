const express = require('express');
const router = express.Router();

const { getOfficials } = require('../controllers/officialController');

// Public, read only (the public Officials page). The list is managed in Settings.
router.get('/', getOfficials);

module.exports = router;
