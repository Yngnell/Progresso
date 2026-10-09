import axios from 'axios';

// Central axios instance. Uses a relative baseURL by default so the Vite
// dev proxy (and same-origin production deploys) work out of the box.
// Override with VITE_API_URL when the API is hosted separately.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api',
});

// Attach the JWT to every request if we have one stored.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
