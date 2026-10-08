import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL || 'https://vidaqa.cloudsolutions.com.sa/auth',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'vidaqa',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'app',
});

export default keycloak;
