import api from './axios';

// SK information, the logo printed on reports, attendance defaults, and (SK Chairperson)
// the officials' accounts.
export const settingsApi = {
  get: () => api.get('/settings').then((r) => r.data),
  save: (data) => api.put('/settings', data).then((r) => r.data),
  uploadLogo: (file) => {
    const form = new FormData();
    form.append('logo', file);
    return api.post('/settings/logo', form).then((r) => r.data);
  },
  removeLogo: () => api.delete('/settings/logo').then((r) => r.data),
  // The uploaded logo, or the SK seal when none was uploaded.
  logoUrl: (settings) =>
    settings?.hasLogo ? `${api.defaults.baseURL}/settings/logo?v=${settings.logoVersion}` : '/logo.jpg',

  accounts: () => api.get('/settings/accounts').then((r) => r.data),
  createAccount: (data) => api.post('/settings/accounts', data).then((r) => r.data),
  updateAccount: (id, data) => api.put(`/settings/accounts/${id}`, data).then((r) => r.data),
};
