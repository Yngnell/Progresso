import api from './axios';

// SK information, the logo printed on reports, attendance defaults, and (SK Admin) the
// list of SK officials (the names in the attendance dropdown).
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

  // { officials }
  officials: () => api.get('/settings/officials').then((r) => r.data),
  // { name, position }
  createOfficial: (data) => api.post('/settings/officials', data).then((r) => r.data),
  // { name?, position?, isActive? }
  updateOfficial: (id, data) => api.put(`/settings/officials/${id}`, data).then((r) => r.data),
  // An official's photo (JPG, PNG or WEBP): upload replaces it, remove goes back to the initial.
  uploadOfficialPhoto: (id, file) => {
    const form = new FormData();
    form.append('photo', file);
    return api.post(`/settings/officials/${id}/photo`, form).then((r) => r.data);
  },
  removeOfficialPhoto: (id) => api.delete(`/settings/officials/${id}/photo`).then((r) => r.data),
};
