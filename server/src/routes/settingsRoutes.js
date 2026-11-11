const express = require('express');
const router = express.Router();

const {
  readSettings,
  saveSettings,
  uploadLogo,
  removeLogo,
  getLogo,
  listOfficials,
  createOfficial,
  updateOfficial,
  setAdminOfficial,
} = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');
const { requireSkAdmin } = require('../utils/roles');
const { logoUpload } = require('../middleware/upload');

// Public: the SK name, term and logo (printed on reports)
router.get('/', readSettings);
router.get('/logo', getLogo);

// Settings → System (including the SK officials list): the SK Admin only
router.put('/', protect, requireSkAdmin, saveSettings);
router.post('/logo', protect, requireSkAdmin, logoUpload, uploadLogo);
router.delete('/logo', protect, requireSkAdmin, removeLogo);
router.get('/officials', protect, requireSkAdmin, listOfficials);
router.post('/officials', protect, requireSkAdmin, createOfficial);
router.put('/officials/:id', protect, requireSkAdmin, updateOfficial);
router.put('/admins/:id', protect, requireSkAdmin, setAdminOfficial);

module.exports = router;
