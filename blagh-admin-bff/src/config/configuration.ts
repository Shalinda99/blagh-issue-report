export default () => ({
  port: parseInt(process.env.PORT, 10) || 4000,
  backendUrl: process.env.BACKEND_URL || 'http://localhost:8002',
  adminFrontendUrl: process.env.ADMIN_FRONTEND_URL || 'http://localhost:5175',
  keycloakUserinfoUrl:
    process.env.KEYCLOAK_USERINFO_URL ||
    'https://dev.cloudsolutions.com.sa/auth/realms/dev/protocol/openid-connect/userinfo',
  adminServiceEmail: process.env.ADMIN_SERVICE_EMAIL || 'admin@blagh.internal',
  adminServicePassword: process.env.ADMIN_SERVICE_PASSWORD || 'ChangeThisPassword!',
  allowedSsoUsernames: process.env.ALLOWED_SSO_USERNAMES || '',
});
