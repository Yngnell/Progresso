const express = require('express');
const router = express.Router();

const {
  readSettings,
  saveSettings,
  uploadLogo,
  removeLogo,
  getLogo,
  listAccounts,
  createAccount,
  updateAccount,
  setAdminOfficial,
} = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');
const { requireSkChair } = require('../utils/roles');
const { logoUpload } = require('../middleware/upload');

// Public: the SK name, term and logo (printed on reports)
router.get('/', readSettings);
router.get('/logo', getLogo);

// Settings → System: the SK Chairperson only
router.put('/', protect, requireSkChair, saveSettings);
router.post('/logo', protect, requireSkChair, logoUpload, uploadLogo);
router.delete('/logo', protect, requireSkChair, removeLogo);
router.get('/accounts', protect, requireSkChair, listAccounts);
router.post('/accounts', protect, requireSkChair, createAccount);
router.put('/accounts/:id', protect, requireSkChair, updateAccount);
router.put('/admins/:id', protect, requireSkChair, setAdminOfficial);

module.exports = router;
