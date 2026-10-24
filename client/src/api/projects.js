// API helpers for Projects (and their expenses).
import api from './axios';

export const projectsApi = {
  list: (params) => api.get('/projects', { params }).then((r) => r.data),
  get: (id) => api.get(`/projects/${id}`).then((r) => r.data),
  report: (id) => api.get(`/projects/${id}/report`).then((r) => r.data),
  create: (data) => api.post('/projects', data).then((r) => r.data),
  update: (id, data) => api.put(`/projects/${id}`, data).then((r) => r.data),
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
  // Chairman: { decision: 'APPROVE' | 'RETURN' | 'REJECT', remarks }
  review: (id, data) => api.put(`/projects/${id}/review`, data).then((r) => r.data),
  // Completion is confirmed by SK council approval: { councilApprovedOn, councilResolutionNo }
  complete: (id, data) => api.post(`/projects/${id}/complete`, data).then((r) => r.data),
  // Cancelling needs a written reason: { reason }
  cancel: (id, data) => api.post(`/projects/${id}/cancel`, data).then((r) => r.data),
  // Archive: approved deletions land here instead of being erased. The chairman can restore.
  archived: () => api.get('/projects', { params: { archived: 'true' } }).then((r) => r.data),
  restore: (id) => api.post(`/projects/${id}/restore`).then((r) => r.data),
  // An expense is a manual budget deduction and needs its receipt: sent as multipart
  // form data with item, amount, date, voucherNo and the receipt file.
  addExpense: (id, formData) =>
    api.post(`/projects/${id}/expenses`, formData).then((r) => r.data),
  attachReceipt: (id, expenseId, file) => {
    const formData = new FormData();
    formData.append('receipt', file);
    return api.post(`/projects/${id}/expenses/${expenseId}/receipt`, formData).then((r) => r.data);
  },
  // Receipts need the login token, so they are fetched and opened from a blob URL.
  openReceipt: async (id, expenseId) => {
    const tab = window.open('', '_blank'); // opened first so the browser allows the pop-up
    try {
      const res = await api.get(`/projects/${id}/expenses/${expenseId}/receipt`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (err) {
      if (tab) tab.close();
      throw err;
    }
  },
  removeExpense: (id, expenseId) =>
    api.delete(`/projects/${id}/expenses/${expenseId}`).then((r) => r.data),
  addTask: (id, data) => api.post(`/projects/${id}/tasks`, data).then((r) => r.data),
  updateTask: (id, taskId, data) =>
    api.put(`/projects/${id}/tasks/${taskId}`, data).then((r) => r.data),
  removeTask: (id, taskId) =>
    api.delete(`/projects/${id}/tasks/${taskId}`).then((r) => r.data),
};
