import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Vite dev server proxies /api requests to the Express backend,
// so the frontend can call relative URLs with no CORS issues in development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
