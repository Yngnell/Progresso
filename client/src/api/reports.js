import api from './axios';

// Data behind the PDF and Excel exports. Dates are YYYY-MM-DD.
export const reportsApi = {
  dashboard: (params) => api.get('/reports/dashboard', { params }).then((r) => r.data),
  attendance: (params) => api.get('/reports/attendance', { params }).then((r) => r.data),
};
