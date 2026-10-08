import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const BASE_URL = import.meta.env.VITE_ASSYST_API_BASE_URL || '';

const CREDENTIALS_KEY = 'mock_assyst_credentials';

export function saveCredentials(username: string, password: string) {
  sessionStorage.setItem(CREDENTIALS_KEY, btoa(`${username}:${password}`));
}

export function clearCredentials() {
  sessionStorage.removeItem(CREDENTIALS_KEY);
}

export function getAuthHeader(): string | null {
  const stored = sessionStorage.getItem(CREDENTIALS_KEY);
  if (stored) return `Basic ${stored}`;
  const defaultCreds = btoa(
    `${import.meta.env.VITE_MOCK_USERNAME || 'mock_user'}:${import.meta.env.VITE_MOCK_PASSWORD || 'change_me'}`
  );
  return `Basic ${defaultCreds}`;
}

const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const auth = getAuthHeader();
  if (auth) config.headers.set('Authorization', auth);
  return config;
});

client.interceptors.response.use(
  (res: AxiosResponse) => res,
  (error: { response?: { status?: number } }) => {
    if (error.response?.status === 401) {
      clearCredentials();
    }
    return Promise.reject(error);
  }
);

export default client;
