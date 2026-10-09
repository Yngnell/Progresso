// API helpers for News & Updates.
import api from './axios';

export const newsApi = {
  list: (params) => api.get('/news', { params }).then((r) => r.data),
  get: (id) => api.get(`/news/${id}`).then((r) => r.data),
  create: (data) => api.post('/news', data).then((r) => r.data),
  update: (id, data) => api.put(`/news/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/news/${id}`).then((r) => r.data),
};
