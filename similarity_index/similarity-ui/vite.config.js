import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The UI talks to the Similarity Check Index service on :8090.
// In dev, /api and /health are proxied so there are no CORS issues.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3100,
    proxy: {
      '/api': { target: 'http://localhost:8090', changeOrigin: true },
      '/health': { target: 'http://localhost:8090', changeOrigin: true },
    },
  },
})
