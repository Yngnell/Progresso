import api from './axios';

// Progress photos of projects and events.
export const photosApi = {
  // target: { projectId } or { eventId }. files: a FileList or array of images.
  upload: (target, files, caption, onProgress) => {
    const form = new FormData();
    Array.from(files).forEach((f) => form.append('photos', f));
    if (caption) form.append('caption', caption);
    const path = target.projectId
      ? `/projects/${target.projectId}/photos`
      : `/events/${target.eventId}/photos`;
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
