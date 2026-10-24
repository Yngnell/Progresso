const express = require('express');
const router = express.Router();

const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  getProjectReport,
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
  addTask,
  updateTask,
  deleteTask,
} = require('../controllers/projectController');
const { protect, optionalAuth, restrictTo } = require('../middleware/auth');
const { receiptUpload } = require('../middleware/upload');

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

// Printable Accomplishment Report data (admin and chairman only, not public)
router.get('/:id/report', protect, restrictTo('ADMIN', 'CHAIRMAN'), getProjectReport);

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
router.post('/:id/complete', protect, restrictTo('ADMIN'), completeProject);
router.post('/:id/cancel', protect, restrictTo('ADMIN'), cancelProject);
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
router.post('/:id/tasks', protect, restrictTo('ADMIN'), addTask);
router.put('/:id/tasks/:taskId', protect, restrictTo('ADMIN'), updateTask);
router.delete('/:id/tasks/:taskId', protect, restrictTo('ADMIN'), deleteTask);

module.exports = router;
