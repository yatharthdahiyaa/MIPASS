import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/users': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/roles': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/policies': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/groups': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/audit-logs': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/me': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
