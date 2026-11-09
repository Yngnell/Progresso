import api from './axios';

// Settings: the signed-in person's own account. The picture saves straight away; a new
// contact number or password waits for the 6-digit code emailed to the account.
export const accountApi = {
  uploadPhoto: (file) => {
    const form = new FormData();
    form.append('photo', file);
    return api.post('/auth/photo', form).then((r) => r.data);
  },
  removePhoto: () => api.delete('/auth/photo').then((r) => r.data),
  // Address of a user's profile picture (version busts the browser cache after a change).
  photoUrl: (user) =>
    user?.hasPhoto ? `${api.defaults.baseURL}/auth/avatar/${user.id}?v=${user.photoVersion}` : null,

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
