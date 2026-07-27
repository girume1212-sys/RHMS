export const API_BASE = process.env.REACT_APP_API_URL || '';

async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('rhms_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  } catch (err) {
    throw new Error('Cannot connect to server. Is the backend running?');
  }
  if (res.status === 401) {
    localStorage.removeItem('rhms_token');
    localStorage.removeItem('rhms_sessionTimeout');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login?expired=1';
    }
    throw new Error('Session expired. Please login again.');
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }
  if (!res.ok) throw new Error('Request failed with status ' + res.status);
  throw new Error('Unexpected response from server');
}

export const api = {
  get: (url) => apiFetch(url),
  post: (url, body) => apiFetch(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => apiFetch(url, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (url, body) => apiFetch(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (url) => apiFetch(url, { method: 'DELETE' }),
};
