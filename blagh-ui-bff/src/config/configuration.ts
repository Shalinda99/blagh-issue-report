export default () => ({
  port: parseInt(process.env.PORT, 10) || 4001,
  backendUrl: process.env.BACKEND_URL || 'http://localhost:8002',
  corsOrigin: process.env.CORS_ORIGIN || '*',
});
