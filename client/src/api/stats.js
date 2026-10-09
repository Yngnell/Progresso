// API helper for admin dashboard stats.
import api from './axios';

export const statsApi = {
  get: () => api.get('/stats').then((r) => r.data),
};
