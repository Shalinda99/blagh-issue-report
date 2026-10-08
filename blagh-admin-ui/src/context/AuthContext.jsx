import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { KEYCLOAK_BASE, KEYCLOAK_CLIENT_ID } from '../config/keycloak.js';

const USER_INFO_KEY = 'csi_admin_userinfo';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_INFO_KEY) || 'null'); } catch { return null; }
  });
  const [sessionChecked, setSessionChecked] = useState(false);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout', {}).catch(() => {});
    localStorage.removeItem(USER_INFO_KEY);
    setIsAuthenticated(false);
    setUserInfo(null);
  }, []);

  const login = useCallback(async (username, password) => {
    const tokenUrl = `${KEYCLOAK_BASE}/protocol/openid-connect/token`;
    const form = new URLSearchParams();
    form.append('grant_type', 'password');
    form.append('username', username);
    form.append('password', password);
    form.append('client_id', KEYCLOAK_CLIENT_ID);
    form.append('scope', 'openid');

    const kcRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    if (!kcRes.ok) {
      const err = await kcRes.json().catch(() => ({}));
      throw new Error(err.error_description || 'Invalid credentials');
    }

    const { access_token } = await kcRes.json();

    const data = await api.post('/api/auth/sso', { token: access_token });
    if (data?.user) {
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(data.user));
      setUserInfo(data.user);
    }
    setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    api.get('/api/auth/me')
      .then(() => setIsAuthenticated(true))
      .catch(() => {
        localStorage.removeItem(USER_INFO_KEY);
        setUserInfo(null);
        setIsAuthenticated(false);
      })
      .finally(() => setSessionChecked(true));
  }, []);

  useEffect(() => {
    window.addEventListener('csi:auth:expired', logout);
    return () => window.removeEventListener('csi:auth:expired', logout);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, userInfo, sessionChecked }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
