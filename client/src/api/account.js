import api from './axios';

// My Account: the signed-in person changes their own login.
export const accountApi = {
  changePassword: (currentPassword, newPassword) =>
    api.put('/auth/password', { currentPassword, newPassword }).then((r) => r.data),
  changeEmail: (newEmail, password) => api.put('/auth/email', { newEmail, password }).then((r) => r.data),
  confirmEmail: (code) => api.post('/auth/email/confirm', { code }).then((r) => r.data),
  resendEmailCode: () => api.post('/auth/email/resend').then((r) => r.data),
  cancelEmailChange: () => api.delete('/auth/email').then((r) => r.data),
};
