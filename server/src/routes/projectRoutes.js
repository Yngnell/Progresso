const express = require('express');
const router = express.Router();

const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  requestDeletion,
  withdrawDeletion,
  listDeletionRequests,
  reviewDeletion,
  restoreProject,
  reviewProject,
  completeProject,
  cancelProject,
  addExpense,
  attachReceipt,
  getReceipt,
  deleteExpense,
  removeReceipt,
} = require('../controllers/projectController');
const { protect, optionalAuth, restrictTo } = require('../middleware/auth');
const { requireSkChair, requireWorker } = require('../utils/roles');
const { receiptUpload, photoUpload } = require('../middleware/upload');
const { addProjectPhotos } = require('../controllers/photoController');

// Public. optionalAuth lets admin/chairman also see not-yet-approved proposals.
router.get('/', optionalAuth, getProjects);

// Deletion requests. Declared before '/:id' so "deletion-requests" isn't read as an id.
router.get('/deletion-requests', protect, restrictTo('ADMIN', 'CHAIRMAN'), listDeletionRequests);
router.put(
  '/deletion-requests/:requestId/review',
  protect,
  restrictTo('CHAIRMAN'),
  reviewDeletion
);

router.get('/:id', optionalAuth, getProject);

// Receipts are proof of spending: only the admin and the chairman can open them
router.get(
  '/:id/expenses/:expenseId/receipt',
  protect,
  restrictTo('ADMIN', 'CHAIRMAN'),
  getReceipt
);

// Barangay Chairman only: approve or return a proposal, and restore archived projects
router.put('/:id/review', protect, restrictTo('CHAIRMAN'), reviewProject);
router.post('/:id/restore', protect, restrictTo('CHAIRMAN'), restoreProject);

// Admin only
// Only the SK Chairperson marks a project as complete (completeProject also checks that
// every expense has its proof and that the expenses equal the budget).
router.post('/:id/complete', protect, requireSkChair, completeProject);
router.post('/:id/cancel', protect, requireSkChair, cancelProject);
router.post('/', protect, restrictTo('ADMIN'), createProject);
router.put('/:id', protect, restrictTo('ADMIN'), updateProject);
// No direct DELETE /:id: removal only happens through an approved deletion request.
router.post('/:id/deletion-request', protect, restrictTo('ADMIN'), requestDeletion);
router.delete('/:id/deletion-request', protect, restrictTo('ADMIN'), withdrawDeletion);
// Adding an expense is a manual budget deduction: it needs an uploaded receipt (multipart)
router.post('/:id/expenses', protect, restrictTo('ADMIN'), receiptUpload, addExpense);
router.post(
  '/:id/expenses/:expenseId/receipt',
  protect,
  restrictTo('ADMIN'),
  receiptUpload,
  attachReceipt
);
router.delete('/:id/expenses/:expenseId', protect, restrictTo('ADMIN'), deleteExpense);
// Remove a wrong proof file so the right one can be uploaded
router.delete('/:id/expenses/:expenseId/receipt', protect, restrictTo('ADMIN'), removeReceipt);
// Pictures shown on the project page: the officials and the admin add them
router.post('/:id/photos', protect, requireWorker, photoUpload, addProjectPhotos);

module.exports = router;
