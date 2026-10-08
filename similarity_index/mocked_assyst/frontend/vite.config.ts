import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/assystREST': {
        target: process.env.VITE_ASSYST_API_BASE_URL || 'http://localhost:8081',
        changeOrigin: true,
      },
      '/mock': {
        target: process.env.VITE_ASSYST_API_BASE_URL || 'http://localhost:8081',
        changeOrigin: true,
      },
      '/health': {
        target: process.env.VITE_ASSYST_API_BASE_URL || 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
  },
});
