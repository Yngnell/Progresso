const express = require('express');
const router = express.Router();

const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  submitProject,
  approveProject,
  rejectProject,
  setSchedule,
  nextStage,
  toggleHold,
  archiveProject,
  uploadDocuments,
  checkDocument,
  deleteDocument,
  getDocumentFile,
  requestDeletion,
  withdrawDeletion,
  listDeletionRequests,
  reviewDeletion,
  restoreProject,
} = require('../controllers/projectController');
const { protect, optionalAuth, restrictTo } = require('../middleware/auth');
const { requireSkAdmin, requireStaff, requireWorker } = require('../utils/roles');
const { documentUpload, photoUpload } = require('../middleware/upload');
const { addProjectPhotos } = require('../controllers/photoController');

// The SK project process (see projectController): the SK Admin does the work, the Barangay
// Chairman only approves or rejects a submitted request and otherwise views.

// Public. optionalAuth lets the SK side also see requests and the Archives tabs.
router.get('/', optionalAuth, getProjects);

// Deletion requests. Declared before '/:id' so "deletion-requests" isn't read as an id.
router.get('/deletion-requests', protect, restrictTo('ADMIN', 'CHAIRMAN'), listDeletionRequests);
router.put('/deletion-requests/:requestId/review', protect, restrictTo('CHAIRMAN'), reviewDeletion);

// One project; the SK side also gets the stage checklist and the stage history.
router.get('/:id', optionalAuth, getProject);

// The Project Request (saved at Pending Approval) and editing its details: SK Admin only.
router.post('/', protect, requireSkAdmin, createProject);
router.put('/:id', protect, requireSkAdmin, updateProject);

// Stage documents: the SK Admin uploads, checks and removes them; the SK side views them.
router.post('/:id/documents', protect, requireSkAdmin, documentUpload, uploadDocuments);
router.patch('/:id/documents/:docId/check', protect, requireSkAdmin, checkDocument);
router.delete('/:id/documents/:docId', protect, requireSkAdmin, deleteDocument);
router.get('/:id/documents/:docId/file', protect, requireStaff, getDocumentFile);

// SK Admin: submit the request, set the schedule (Approved), move forward, hold or resume,
// and archive a completed project.
router.patch('/:id/submit', protect, requireSkAdmin, submitProject);
router.put('/:id/schedule', protect, requireSkAdmin, setSchedule);
router.patch('/:id/next-stage', protect, requireSkAdmin, nextStage);
router.patch('/:id/hold', protect, requireSkAdmin, toggleHold);
router.patch('/:id/archive', protect, requireSkAdmin, archiveProject);

// Barangay Chairman only: approve, or reject with remarks, a submitted request.
router.patch('/:id/approve', protect, restrictTo('CHAIRMAN'), approveProject);
router.patch('/:id/reject', protect, restrictTo('CHAIRMAN'), rejectProject);

// Deletion: requested by the admins, decided by the Barangay Chairman (who can restore).
// No direct DELETE /:id: removal only happens through an approved deletion request.
router.post('/:id/deletion-request', protect, restrictTo('ADMIN'), requestDeletion);
router.delete('/:id/deletion-request', protect, restrictTo('ADMIN'), withdrawDeletion);
router.post('/:id/restore', protect, restrictTo('CHAIRMAN'), restoreProject);

// Pictures shown on the project page: the officials and the admin add them
router.post('/:id/photos', protect, requireWorker, photoUpload, addProjectPhotos);

module.exports = router;
