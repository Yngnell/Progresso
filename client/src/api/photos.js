import api from './axios';

// Pictures of projects.
export const photosApi = {
  // target: { projectId }. items: [{ file, caption }] (up to 10).
  upload: (target, items, onProgress) => {
    const form = new FormData();
    items.forEach(({ file, caption }) => {
      form.append('photos', file);
      form.append('captions', (caption || '').trim());
    });
    const path = `/projects/${target.projectId}/photos`;
    return api
      .post(path, form, {
        onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
      })
      .then((r) => r.data);
  },
  remove: (id) => api.delete(`/photos/${id}`).then((r) => r.data),
  // Address of the image itself, usable directly in <img src>.
  url: (id) => `${api.defaults.baseURL}/photos/${id}/file`,
};
