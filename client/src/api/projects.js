// API helpers for the SK project process:
//   Project Request (Draft -> Pending) · Review (Chairman) · Start (Approved -> Ongoing)
//   Expense · File Upload · Completion · Cancellation
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

// Files accepted by the project file module. File Upload also takes Word and Excel files.
export const FILE_ACCEPT = '.jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx';
export const RECEIPT_ACCEPT = '.pdf,.jpg,.jpeg,.png';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

// The document type File Upload gives a file, from its extension and file type (the server
// decides the same way). null when the file type is not supported.
const DOCUMENT_TYPE_BY_EXT = [
  [/\.(jpe?g|png)$/i, ['image/jpeg', 'image/png'], 'IMAGE', 'Image'],
  [/\.pdf$/i, ['application/pdf'], 'PDF', 'PDF Document'],
  [/\.docx?$/i, ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], 'WORD', 'Word Document'],
  [/\.xlsx?$/i, ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], 'EXCEL', 'Excel Spreadsheet'],
];
const GENERIC_TYPES = ['', 'application/octet-stream', 'application/zip', 'application/x-zip-compressed'];
export function detectDocumentType(file) {
  if (!file) return null;
  const hit = DOCUMENT_TYPE_BY_EXT.find(([re]) => re.test(file.name || ''));
  if (!hit) return null;
  const [, types, value, label] = hit;
  if (!types.includes(file.type) && !GENERIC_TYPES.includes(file.type || '')) return null;
  return { value, label };
}

// A message when a chosen file cannot be uploaded, else null.
export function checkFile(file, { receipt = false } = {}) {
  if (!file) return null;
  if (receipt) {
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) return 'Choose a PDF, JPG or PNG file.';
  } else if (!detectDocumentType(file)) {
    return 'This file type is not supported. Upload an image (JPG or PNG), PDF, Word or Excel file.';
  }
  if (file.size > MAX_FILE_BYTES) return 'The file must be 10 MB or smaller.';
  return null;
}

const form = (fields) => {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') fd.append(k, v);
  });
  return fd;
};

export const projectsApi = {
  // Active projects; { archive: 'completed' | 'rejected' | 'cancelled' | 'deleted' | 'all' }
  // lists one tab of Archives (or everything); { status: 'PENDING' } narrows the list.
  list: (params) => api.get('/projects', { params }).then((r) => r.data),
  get: (id) => api.get(`/projects/${id}`).then((r) => r.data),

  // Project Request: saved as a Draft; submit sends it to the Barangay Chairman.
  create: (data) => api.post('/projects', data).then((r) => r.data),
  update: (id, data) => api.put(`/projects/${id}`, data).then((r) => r.data),
  submit: (id) => api.patch(`/projects/${id}/submit`).then((r) => r.data),
  // Review (Barangay Chairman): { decision: 'APPROVE' | 'RETURN' | 'REJECT', remarks }
  review: (id, data) => api.patch(`/projects/${id}/review`, data).then((r) => r.data),
  // Approved -> Ongoing
  start: (id) => api.patch(`/projects/${id}/start`).then((r) => r.data),
  // Expense: { receipt, amount, date, supplier?, category? }
  addExpense: (id, fields) => api.post(`/projects/${id}/expenses`, form(fields)).then((r) => r.data),
  deleteExpense: (id, expenseId) => api.delete(`/projects/${id}/expenses/${expenseId}`).then((r) => r.data),
  // Claude reads a receipt to prefill the Expense form: { readable, total, date, storeName, category }
  readReceipt: (file) => api.post('/projects/receipt-read', form({ file })).then((r) => r.data),
  // File Upload: { file }. The server sets the document type from the file.
  addFile: (id, fields) => api.post(`/projects/${id}/files`, form(fields)).then((r) => r.data),
  deleteFile: (id, fileId) => api.delete(`/projects/${id}/files/${fileId}`).then((r) => r.data),
  // Completion
  completionInfo: (id) => api.get(`/projects/${id}/completion-info`).then((r) => r.data),
  complete: (id, fields) => api.patch(`/projects/${id}/complete`, form(fields)).then((r) => r.data),
  // Cancellation: { reason, date }
  cancel: (id, data) => api.patch(`/projects/${id}/cancel`, data).then((r) => r.data),

  // The files need the login token, so they are fetched and opened from a blob URL.
  openFile: async (id, fileId) => {
    const tab = window.open('', '_blank'); // opened first so the browser allows the pop-up
    try {
      const res = await api.get(`/projects/${id}/files/${fileId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (err) {
      if (tab) tab.close();
      throw err;
    }
  },
  // Download of a section: 'receipt-liquidation' (one PDF).
  // Saves the file as e.g. ProjectName_Receipt_Liquidation.pdf.
  downloadSection: async (project, section) => {
    const res = await api.get(`/projects/${project.id}/download/${section}`, { responseType: 'blob' });
    const base = downloadBase(project.title);
    const name = {
      'receipt-liquidation': `${base}_Receipt_Liquidation.pdf`,
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
