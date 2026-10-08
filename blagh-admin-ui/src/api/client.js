const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401 && !path.startsWith('/api/auth')) {
    window.dispatchEvent(new CustomEvent('csi:auth:expired'));
    return;
  }

  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : null;

  if (!res.ok) {
    const message = data?.message || data?.detail || `HTTP ${res.status}`;
    throw new Error(message);
  }

  return data;
}

export const api = {
  get:   (path)         => request(path, { method: 'GET' }),
  post:  (path, body)   => request(path, { method: 'POST',  body: JSON.stringify(body) }),
  patch: (path, body)   => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
