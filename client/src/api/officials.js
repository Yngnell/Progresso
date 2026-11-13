// The SK officials' names, positions and photos (public, read only). They are managed in
// Settings → System by the SK Admin.
import api from './axios';

export const officialsApi = {
  list: (params) => api.get('/officials', { params }).then((r) => r.data),
  // An official's uploaded photo (only when official.hasPhoto); the version busts the cache.
  photoUrl: (official) => `${api.defaults.baseURL}/officials/${official.id}/photo?v=${official.photoVersion || 0}`,
};
