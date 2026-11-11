// The SK officials' names and positions (public, read only). They are managed in
// Settings → System by the SK Admin.
import api from './axios';

export const officialsApi = {
  list: (params) => api.get('/officials', { params }).then((r) => r.data),
};
