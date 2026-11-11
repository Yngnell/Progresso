import api from './axios';

// Settings: the signed-in person's own account. A new contact number or password waits for
// the 6-digit code emailed to the account.
export const accountApi = {
  requestPhoneChange: (phone) => api.post('/auth/phone/request', { phone }).then((r) => r.data),
  requestPasswordChange: (currentPassword, newPassword, confirmPassword) =>
    api.post('/auth/password/request', { currentPassword, newPassword, confirmPassword }).then((r) => r.data),
  verifyChange: (code) => api.post('/auth/verify-change', { code }).then((r) => r.data),
  resendChangeCode: () => api.post('/auth/verify-change/resend').then((r) => r.data),

  // Forgot password (no login needed)
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then((r) => r.data),
  checkResetToken: (token) => api.get(`/auth/reset-password/${encodeURIComponent(token)}`).then((r) => r.data),
  resetPassword: (token, password, confirmPassword) =>
    api.post('/auth/reset-password', { token, password, confirmPassword }).then((r) => r.data),
};
