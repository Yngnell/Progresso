import api from './axios';

export const attendanceApi = {
  list: (eventId) => api.get(`/attendance/event/${eventId}`).then((r) => r.data),
  summary: (eventId) => api.get(`/attendance/summary/${eventId}`).then((r) => r.data),
  mark: (eventId, payload) =>
    api.post(`/attendance/event/${eventId}`, payload).then((r) => r.data),
  updateRecord: (id, data) => api.put(`/attendance/record/${id}`, data).then((r) => r.data),
  removeRecord: (id) => api.delete(`/attendance/record/${id}`).then((r) => r.data),
};
