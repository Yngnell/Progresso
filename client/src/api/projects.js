// API helpers for Projects and their flow:
// Project Request -> Proposed -> Planning -> Ongoing -> Completed (or Proposed -> Cancelled).
import api from './axios';

// The project name as a file name, the same way the server writes it:
// "SK Basketball League 2026" -> "SK_Basketball_League_2026".
export function downloadBase(title) {
  const base = String(title || '')
    .replace(/[\\/:*?"<>|#%&{}$!'@+`=]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.]+|[_.]+$/g, '')
    .slice(0, 80);
  return base || 'Project';
}

export const projectsApi = {
  // Active projects (Proposed, Planning, Ongoing, On Hold); { archive: 'completed' |
  // 'cancelled' | 'onhold' | 'deleted' } lists one tab of Archives.
  list: (params) => api.get('/projects', { params }).then((r) => r.data),
  get: (id) => api.get(`/projects/${id}`).then((r) => r.data),
  // The Project Request: saved as Proposed.
  create: (data) => api.post('/projects', data).then((r) => r.data),
  update: (id, data) => api.put(`/projects/${id}`, data).then((r) => r.data),
  // Barangay Chairman: { decision: 'APPROVE' | 'REJECT', remarks }
  review: (id, data) => api.put(`/projects/${id}/review`, data).then((r) => r.data),
  // SK Admin, Planning: { startDate, endDate } -> Ongoing
  setSchedule: (id, data) => api.put(`/projects/${id}/schedule`, data).then((r) => r.data),
  // SK Admin, Ongoing: receipt liquidation (JPG, PNG or PDF; several at once)
  uploadLiquidation: (id, files) => {
    const formData = new FormData();
    [...files].forEach((f) => formData.append('files', f));
    return api.post(`/projects/${id}/liquidation`, formData).then((r) => r.data);
  },
  deleteLiquidation: (id, fileId) =>
    api.delete(`/projects/${id}/liquidation/${fileId}`).then((r) => r.data),
  // SK Admin, Ongoing: type or correct a receipt's { amount, receiptDate, storeName }
  updateLiquidation: (id, fileId, data) =>
    api.put(`/projects/${id}/liquidation/${fileId}`, data).then((r) => r.data),
  // The files need the login token, so they are fetched and opened from a blob URL.
  openLiquidation: async (id, fileId) => {
    const tab = window.open('', '_blank'); // opened first so the browser allows the pop-up
    try {
      const res = await api.get(`/projects/${id}/liquidation/${fileId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (err) {
      if (tab) tab.close();
      throw err;
    }
  },
  // Purchase Request files (scanned or signed PR forms): SK Admin adds and removes them.
  uploadPrFiles: (id, files) => {
    const formData = new FormData();
    [...files].forEach((f) => formData.append('files', f));
    return api.post(`/projects/${id}/pr-files`, formData).then((r) => r.data);
  },
  deletePrFile: (id, fileId) => api.delete(`/projects/${id}/pr-files/${fileId}`).then((r) => r.data),
  openPrFile: async (id, fileId) => {
    const tab = window.open('', '_blank'); // opened first so the browser allows the pop-up
    try {
      const res = await api.get(`/projects/${id}/pr-files/${fileId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (err) {
      if (tab) tab.close();
      throw err;
    }
  },
  // Downloads of a section: 'receipt-liquidation' | 'purchase-request' (one PDF each) or
  // 'pictures' (one ZIP). Saves the file as e.g. ProjectName_Receipt_Liquidation.pdf.
  downloadSection: async (project, section) => {
    const res = await api.get(`/projects/${project.id}/download/${section}`, { responseType: 'blob' });
    const base = downloadBase(project.title);
    const name = {
      'receipt-liquidation': `${base}_Receipt_Liquidation.pdf`,
      'purchase-request': `${base}_Purchase_Request.pdf`,
      pictures: `${base}_Pictures.zip`,
    }[section];
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
  // SK Admin, Ongoing: the optional checklist
  addChecklistItem: (id, label) => api.post(`/projects/${id}/checklist`, { label }).then((r) => r.data),
  updateChecklistItem: (id, itemId, data) =>
    api.put(`/projects/${id}/checklist/${itemId}`, data).then((r) => r.data),
  deleteChecklistItem: (id, itemId) =>
    api.delete(`/projects/${id}/checklist/${itemId}`).then((r) => r.data),
  // SK Admin, Ongoing -> Completed
  complete: (id) => api.post(`/projects/${id}/complete`).then((r) => r.data),
  // SK Admin: Ongoing -> On Hold, On Hold -> Ongoing, On Hold -> Archives (On Hold tab)
  hold: (id) => api.post(`/projects/${id}/hold`).then((r) => r.data),
  resume: (id) => api.post(`/projects/${id}/resume`).then((r) => r.data),
  archiveHold: (id) => api.post(`/projects/${id}/archive-hold`).then((r) => r.data),
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
