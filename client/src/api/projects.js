// API helpers for Projects and the SK project process:
// Pending Approval > Approved > Purchasing > Fund Release > Implementation > Liquidation >
// Completed (or Rejected; On Hold pauses a stage; a completed project can be Archived).
import api from './axios';

export const projectsApi = {
  // Active projects; { status: 'A,B' } narrows the stages, { submitted: 'true' } keeps the
  // requests sent to the Barangay Chairman, and { archive: 'completed' | 'rejected' |
  // 'archived' | 'deleted' } lists one tab of Archives.
  list: (params) => api.get('/projects', { params }).then((r) => r.data),
  // One project with its stage checklist and stage history.
  get: (id) => api.get(`/projects/${id}`).then((r) => r.data),
  // The Project Request: saved at Pending Approval.
  create: (data) => api.post('/projects', data).then((r) => r.data),
  // Details; at Liquidation also { amountSpent }.
  update: (id, data) => api.put(`/projects/${id}`, data).then((r) => r.data),

  // SK Admin: the documents of the current stage (PDF, JPG or PNG; up to 10 MB each).
  uploadDocuments: (id, requiredDocumentId, files) => {
    const formData = new FormData();
    formData.append('requiredDocumentId', requiredDocumentId);
    [...files].forEach((f) => formData.append('files', f));
    return api.post(`/projects/${id}/documents`, formData).then((r) => r.data);
  },
  checkDocument: (id, docId, isChecked) =>
    api.patch(`/projects/${id}/documents/${docId}/check`, { isChecked }).then((r) => r.data),
  deleteDocument: (id, docId) => api.delete(`/projects/${id}/documents/${docId}`).then((r) => r.data),
  // The files need the login token, so they are fetched as a blob (for the preview).
  documentBlob: (id, docId) =>
    api.get(`/projects/${id}/documents/${docId}/file`, { responseType: 'blob' }).then((r) => r.data),

  // SK Admin: submit the request, set the schedule (Approved), move on, hold or resume, archive.
  submit: (id) => api.patch(`/projects/${id}/submit`).then((r) => r.data),
  setSchedule: (id, data) => api.put(`/projects/${id}/schedule`, data).then((r) => r.data),
  nextStage: (id, remarks) => api.patch(`/projects/${id}/next-stage`, { remarks }).then((r) => r.data),
  toggleHold: (id, remarks) => api.patch(`/projects/${id}/hold`, { remarks }).then((r) => r.data),
  archive: (id) => api.patch(`/projects/${id}/archive`).then((r) => r.data),

  // Barangay Chairman: approve, or reject with remarks (required).
  approve: (id, remarks) => api.patch(`/projects/${id}/approve`, { remarks }).then((r) => r.data),
  reject: (id, remarks) => api.patch(`/projects/${id}/reject`, { remarks }).then((r) => r.data),

  // Projects are never deleted directly: file a request with a reason, then the
  // chairman approves ({ decision: 'APPROVE' | 'REJECT', remarks }) or rejects it.
  requestDeletion: (id, reason) =>
    api.post(`/projects/${id}/deletion-request`, { reason }).then((r) => r.data),
  withdrawDeletion: (id) =>
    api.delete(`/projects/${id}/deletion-request`).then((r) => r.data),
  deletionRequests: (params) =>
    api.get('/projects/deletion-requests', { params }).then((r) => r.data),
  reviewDeletion: (requestId, data) =>
    api.put(`/projects/deletion-requests/${requestId}/review`, data).then((r) => r.data),
  // Deleted projects (Archives > Deleted): the chairman can restore one.
  restore: (id) => api.post(`/projects/${id}/restore`).then((r) => r.data),
};
