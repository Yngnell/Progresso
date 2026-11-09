import api from './axios';

export const attendanceApi = {
  list: (eventId) => api.get(`/attendance/event/${eventId}`).then((r) => r.data),
  summary: (eventId) => api.get(`/attendance/summary/${eventId}`).then((r) => r.data),
  updateRecord: (id, data) => api.put(`/attendance/record/${id}`, data).then((r) => r.data),
  // Admin: record someone by hand ({ userId } or { participant }, status, timeIn)
  addManual: (eventId, data) => api.post(`/attendance/event/${eventId}/manual`, data).then((r) => r.data),

  // Attendance QR (SK Chairperson): the event's code and how long it stays valid
  qr: (eventId) => api.get(`/attendance/qr/${eventId}`).then((r) => r.data),
  // { validFrom, validUntil, regenerate }
  generateQr: (eventId, data = {}) => api.post(`/attendance/qr/${eventId}`, data).then((r) => r.data),
  // { active } and/or { validFrom, validUntil }
  updateQr: (eventId, data) => api.put(`/attendance/qr/${eventId}`, data).then((r) => r.data),

  // An official checking in by scanning the QR
  checkIn: (eventId, token) => api.post('/attendance/checkin', { eventId, token }).then((r) => r.data),
};

// The link inside an event's QR code.
export const checkInLink = (eventId, token) =>
  `${window.location.origin}/checkin?e=${encodeURIComponent(eventId)}&t=${encodeURIComponent(token)}`;
