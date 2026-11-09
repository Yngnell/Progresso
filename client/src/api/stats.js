// API helper for admin dashboard stats.
import api from './axios';

export const statsApi = {
  // params: { projectId } narrows the analytics to one project
  get: (params) => api.get('/stats', { params }).then((r) => r.data),
};
