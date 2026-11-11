import api from './axios';

export const attendanceApi = {
  list: (eventId) => api.get(`/attendance/event/${eventId}`).then((r) => r.data),
  summary: (eventId) => api.get(`/attendance/summary/${eventId}`).then((r) => r.data),

  // Attendance QR (SK Admin): the meeting's code and when attendance is open
  qr: (eventId) => api.get(`/attendance/qr/${eventId}`).then((r) => r.data),
  // { validFrom, validUntil, regenerate }
  generateQr: (eventId, data = {}) => api.post(`/attendance/qr/${eventId}`, data).then((r) => r.data),
  // { active } and/or { validFrom, validUntil }
  updateQr: (eventId, data) => api.put(`/attendance/qr/${eventId}`, data).then((r) => r.data),

  // The page the QR code opens (no login): the names still to mark, and marking one Present
  page: (eventId, token) => api.get(`/attendance/public/${eventId}`, { params: { t: token } }).then((r) => r.data),
  markPresent: (eventId, token, officialId) =>
    api.post(`/attendance/public/${eventId}`, { token, officialId }).then((r) => r.data),
};

// The link inside an event's QR code.
export const checkInLink = (eventId, token) =>
  `${window.location.origin}/checkin?e=${encodeURIComponent(eventId)}&t=${encodeURIComponent(token)}`;
