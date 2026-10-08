import axios from 'axios'

// In dev, Vite proxies /api and /health to the service on :8090.
// In prod, VITE_API_BASE_URL can point at the deployed service.
const baseURL = import.meta.env.VITE_API_BASE_URL || ''

const http = axios.create({ baseURL, timeout: 120000 })

export const api = {
  health: () => http.get('/health').then((r) => r.data),
  stats: () => http.get('/api/stats').then((r) => r.data),
  sync: (body) => http.post('/api/sync', body).then((r) => r.data),
  reset: () => http.post('/api/reset').then((r) => r.data),
  issues: (params) => http.get('/api/issues', { params }).then((r) => r.data),
  issueDetail: (uid) =>
    http.get(`/api/issues/${encodeURIComponent(uid)}`).then((r) => r.data),
  detect: (params) => http.post('/api/detect', null, { params }).then((r) => r.data),
  duplicates: (params) =>
    http.get('/api/duplicates', { params }).then((r) => r.data),
  compare: (body) => http.post('/api/compare', body).then((r) => r.data),
}
