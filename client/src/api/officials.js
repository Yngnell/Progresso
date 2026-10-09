// API helpers for Officials.
import api from './axios';

export const officialsApi = {
  list: (params) => api.get('/officials', { params }).then((r) => r.data),
  get: (id) => api.get(`/officials/${id}`).then((r) => r.data),
  create: (data) => api.post('/officials', data).then((r) => r.data),
  update: (id, data) => api.put(`/officials/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/officials/${id}`).then((r) => r.data),
};
