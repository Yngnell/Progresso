import api from './axios';

// Settings → Profile and Security: the signed-in person changes their own account.
export const accountApi = {
  updateProfile: (data) => api.put('/auth/profile', data).then((r) => r.data),
  uploadPhoto: (file) => {
    const form = new FormData();
    form.append('photo', file);
    return api.post('/auth/photo', form).then((r) => r.data);
  },
  removePhoto: () => api.delete('/auth/photo').then((r) => r.data),
  // Address of a user's profile picture (version busts the browser cache after a change).
  photoUrl: (user) =>
    user?.hasPhoto ? `${api.defaults.baseURL}/auth/avatar/${user.id}?v=${user.photoVersion}` : null,
  changePassword: (currentPassword, newPassword, confirmPassword) =>
    api.put('/auth/password', { currentPassword, newPassword, confirmPassword }).then((r) => r.data),
  changeEmail: (newEmail, password) => api.put('/auth/email', { newEmail, password }).then((r) => r.data),
  confirmEmail: (code) => api.post('/auth/email/confirm', { code }).then((r) => r.data),
  resendEmailCode: () => api.post('/auth/email/resend').then((r) => r.data),
  cancelEmailChange: () => api.delete('/auth/email').then((r) => r.data),

  // Forgot password (no login needed)
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then((r) => r.data),
  checkResetToken: (token) => api.get(`/auth/reset-password/${encodeURIComponent(token)}`).then((r) => r.data),
  resetPassword: (token, password, confirmPassword) =>
    api.post('/auth/reset-password', { token, password, confirmPassword }).then((r) => r.data),
};
