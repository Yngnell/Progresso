// API helpers for in-app notifications (admin and chairman). The same alerts are
// emailed automatically to each account's registered email by the server.
import api from './axios';

export const notificationsApi = {
  list: () => api.get('/notifications').then((r) => r.data),
  markRead: (id) => api.put(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.put('/notifications/read-all').then((r) => r.data),
};
