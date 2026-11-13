const express = require('express');
const router = express.Router();

const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  submitProject,
  reviewProject,
  startProject,
  addProgress,
  readReceiptFile,
  addExpense,
  deleteExpense,
  addFile,
  deleteFile,
  getFile,
  getCompletionInfo,
  completeProject,
  cancelProject,
  downloadLiquidation,
  downloadPurchaseRequest,
  downloadPictures,
  requestDeletion,
  withdrawDeletion,
  listDeletionRequests,
  reviewDeletion,
  restoreProject,
} = require('../controllers/projectController');
const { protect, optionalAuth, restrictTo } = require('../middleware/auth');
const { requireSkAdmin, requireStaff, requireWorker } = require('../utils/roles');
const { projectFiles, photoUpload } = require('../middleware/upload');
const { addProjectPhotos } = require('../controllers/photoController');

// The SK project process (Forms 3 to 9). The SK Admin does every form except Form 4, which
// is the Barangay Chairman's; the server checks the role and the project's status each time.

// Public list and details (the SK side sees more; see the controller).
router.get('/', optionalAuth, getProjects);

// Declared before '/:id' so these names aren't read as an id.
router.get('/deletion-requests', protect, restrictTo('ADMIN', 'CHAIRMAN'), listDeletionRequests);
router.put('/deletion-requests/:requestId/review', protect, restrictTo('CHAIRMAN'), reviewDeletion);
// Form 6 helper: Claude reads a receipt to prefill the form (nothing is saved).
router.post('/receipt-read', protect, requireSkAdmin, projectFiles(['file']), readReceiptFile);

router.get('/:id', optionalAuth, getProject);

// Form 3: Project Request (saved as a Draft, then submitted)
router.post('/', protect, requireSkAdmin, createProject);
router.put('/:id', protect, requireSkAdmin, updateProject);
router.patch('/:id/submit', protect, requireSkAdmin, submitProject);
// Form 4: Review (Barangay Chairman)
router.patch('/:id/review', protect, restrictTo('CHAIRMAN'), reviewProject);
// Approved -> Ongoing
router.patch('/:id/start', protect, requireSkAdmin, startProject);
// Form 5: Progress Update (optional picture)
router.post('/:id/progress', protect, requireSkAdmin, photoUpload, addProgress);
// Form 6: Expense (receipt required)
router.post('/:id/expenses', protect, requireSkAdmin, projectFiles(['receipt']), addExpense);
router.delete('/:id/expenses/:expenseId', protect, requireSkAdmin, deleteExpense);
// Form 7: File Upload
router.post('/:id/files', protect, requireSkAdmin, projectFiles(['file']), addFile);
router.delete('/:id/files/:fileId', protect, requireSkAdmin, deleteFile);
router.get('/:id/files/:fileId', protect, requireStaff, getFile);
router.get('/:id/liquidation/:fileId', protect, requireStaff, getFile); // older links
// Form 8: Completion
router.get('/:id/completion-info', protect, requireStaff, getCompletionInfo);
router.patch('/:id/complete', protect, requireSkAdmin, projectFiles(['report', 'liquidation']), completeProject);
// Form 9: Cancellation
router.patch('/:id/cancel', protect, requireSkAdmin, cancelProject);

// Downloads: receipts and PR files as one PDF each, pictures as one ZIP (the SK side).
router.get('/:id/download/receipt-liquidation', protect, requireStaff, downloadLiquidation);
router.get('/:id/download/purchase-request', protect, requireStaff, downloadPurchaseRequest);
router.get('/:id/download/pictures', protect, requireStaff, downloadPictures);

// Deletion: requested by the SK Admin, decided by the Barangay Chairman (who can restore).
// No direct DELETE /:id: removal only happens through an approved deletion request.
router.post('/:id/deletion-request', protect, requireSkAdmin, requestDeletion);
router.delete('/:id/deletion-request', protect, requireSkAdmin, withdrawDeletion);
router.post('/:id/restore', protect, restrictTo('CHAIRMAN'), restoreProject);

// Pictures shown on the project page
router.post('/:id/photos', protect, requireWorker, photoUpload, addProjectPhotos);

module.exports = router;
