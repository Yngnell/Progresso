const express = require('express');
const router = express.Router();

const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  reviewProject,
  setSchedule,
  addLiquidation,
  getLiquidationFile,
  deleteLiquidationFile,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  completeProject,
  requestDeletion,
  withdrawDeletion,
  listDeletionRequests,
  reviewDeletion,
  restoreProject,
} = require('../controllers/projectController');
const { protect, optionalAuth, restrictTo } = require('../middleware/auth');
const { requireSkAdmin, requireStaff, requireWorker } = require('../utils/roles');
const { liquidationUpload, photoUpload } = require('../middleware/upload');
const { addProjectPhotos } = require('../controllers/photoController');

// Public. optionalAuth lets the SK side also see proposals and the Archives tabs.
router.get('/', optionalAuth, getProjects);

// Deletion requests. Declared before '/:id' so "deletion-requests" isn't read as an id.
router.get('/deletion-requests', protect, restrictTo('ADMIN', 'CHAIRMAN'), listDeletionRequests);
router.put('/deletion-requests/:requestId/review', protect, restrictTo('CHAIRMAN'), reviewDeletion);

router.get('/:id', optionalAuth, getProject);

// The Project Request (saved as Proposed) and editing its details: the SK side's admins.
router.post('/', protect, restrictTo('ADMIN'), createProject);
router.put('/:id', protect, restrictTo('ADMIN'), updateProject);

// Proposed: only the Barangay Chairman approves (-> Planning) or rejects (-> Cancelled).
router.put('/:id/review', protect, restrictTo('CHAIRMAN'), reviewProject);

// Planning -> Ongoing, Ongoing -> Completed, and the liquidation and checklist in
// between: the SK Admin account only.
router.put('/:id/schedule', protect, requireSkAdmin, setSchedule);
router.post('/:id/liquidation', protect, requireSkAdmin, liquidationUpload, addLiquidation);
router.delete('/:id/liquidation/:fileId', protect, requireSkAdmin, deleteLiquidationFile);
router.post('/:id/checklist', protect, requireSkAdmin, addChecklistItem);
router.put('/:id/checklist/:itemId', protect, requireSkAdmin, updateChecklistItem);
router.delete('/:id/checklist/:itemId', protect, requireSkAdmin, deleteChecklistItem);
router.post('/:id/complete', protect, requireSkAdmin, completeProject);

// Viewing a liquidation file: the SK side (also from Archives, view only).
router.get('/:id/liquidation/:fileId', protect, requireStaff, getLiquidationFile);

// Deletion: requested by the admins, decided by the Barangay Chairman (who can restore).
// No direct DELETE /:id: removal only happens through an approved deletion request.
router.post('/:id/deletion-request', protect, restrictTo('ADMIN'), requestDeletion);
router.delete('/:id/deletion-request', protect, restrictTo('ADMIN'), withdrawDeletion);
router.post('/:id/restore', protect, restrictTo('CHAIRMAN'), restoreProject);

// Pictures shown on the project page: the officials and the admin add them
router.post('/:id/photos', protect, requireWorker, photoUpload, addProjectPhotos);

module.exports = router;
