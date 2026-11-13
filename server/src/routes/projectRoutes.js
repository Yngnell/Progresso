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
  requestDeletion,
  withdrawDeletion,
  listDeletionRequests,
  reviewDeletion,
  restoreProject,
} = require('../controllers/projectController');
const { protect, optionalAuth, restrictTo } = require('../middleware/auth');
const { requireSkAdmin, requireStaff } = require('../utils/roles');
const { projectFiles } = require('../middleware/upload');

// The SK project process. The SK Admin does every form except the Review, which
// is the Barangay Chairman's; the server checks the role and the project's status each time.

// Public list and details (the SK side sees more; see the controller).
router.get('/', optionalAuth, getProjects);

// Declared before '/:id' so these names aren't read as an id.
router.get('/deletion-requests', protect, restrictTo('ADMIN', 'CHAIRMAN'), listDeletionRequests);
router.put('/deletion-requests/:requestId/review', protect, restrictTo('CHAIRMAN'), reviewDeletion);
// Expense helper: Claude reads a receipt to prefill the form (nothing is saved).
router.post('/receipt-read', protect, requireSkAdmin, projectFiles(['file']), readReceiptFile);

router.get('/:id', optionalAuth, getProject);

// Project Request (saved as a Draft, then submitted)
router.post('/', protect, requireSkAdmin, createProject);
router.put('/:id', protect, requireSkAdmin, updateProject);
router.patch('/:id/submit', protect, requireSkAdmin, submitProject);
// Review (Barangay Chairman)
router.patch('/:id/review', protect, restrictTo('CHAIRMAN'), reviewProject);
// Approved -> Ongoing
router.patch('/:id/start', protect, requireSkAdmin, startProject);
// Expense (receipt required)
router.post('/:id/expenses', protect, requireSkAdmin, projectFiles(['receipt']), addExpense);
router.delete('/:id/expenses/:expenseId', protect, requireSkAdmin, deleteExpense);
// File Upload
router.post('/:id/files', protect, requireSkAdmin, projectFiles(['file']), addFile);
router.delete('/:id/files/:fileId', protect, requireSkAdmin, deleteFile);
router.get('/:id/files/:fileId', protect, requireStaff, getFile);
router.get('/:id/liquidation/:fileId', protect, requireStaff, getFile); // older links
// Completion
router.get('/:id/completion-info', protect, requireStaff, getCompletionInfo);
router.patch('/:id/complete', protect, requireSkAdmin, projectFiles(['report', 'liquidation']), completeProject);
// Cancellation
router.patch('/:id/cancel', protect, requireSkAdmin, cancelProject);

// Downloads: receipts and PR files as one PDF each (the SK side).
router.get('/:id/download/receipt-liquidation', protect, requireStaff, downloadLiquidation);
router.get('/:id/download/purchase-request', protect, requireStaff, downloadPurchaseRequest);

// Deletion: requested by the SK Admin, decided by the Barangay Chairman (who can restore).
// No direct DELETE /:id: removal only happens through an approved deletion request.
router.post('/:id/deletion-request', protect, requireSkAdmin, requestDeletion);
router.delete('/:id/deletion-request', protect, requireSkAdmin, withdrawDeletion);
router.post('/:id/restore', protect, restrictTo('CHAIRMAN'), restoreProject);


module.exports = router;
