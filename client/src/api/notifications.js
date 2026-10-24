// API helpers for in-app notifications (admin and chairman).
import api from './axios';

export const notificationsApi = {
  list: () => api.get('/notifications').then((r) => r.data),
  markRead: (id) => api.put(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.put('/notifications/read-all').then((r) => r.data),
  // Where this person's alerts are also emailed (blank = off).
  emailSettings: () => api.get('/notifications/email-settings').then((r) => r.data),
  saveEmail: (email) => api.put('/notifications/email-settings', { email }).then((r) => r.data),
  sendTestEmail: () => api.post('/notifications/test-email').then((r) => r.data),
};
