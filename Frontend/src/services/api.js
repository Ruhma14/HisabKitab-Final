const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

export const getToken = () =>
  localStorage.getItem('hisabkitab_auth_token') ||
  sessionStorage.getItem('hisabkitab_auth_token');

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(`Cannot connect to the HisabKitab server. Check VITE_API_URL and make sure the backend is running.`);
  }

  let data = {};
  try { data = await res.json(); } catch {}

  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

export const apiGet = (p) => api(p);
export const apiPost = (p, b) => api(p, { method: 'POST', body: b });
export const apiPut = (p, b) => api(p, { method: 'PUT', body: b });
export const apiPatch = (p, b) => api(p, { method: 'PATCH', body: b });
export const apiDelete = (p) => api(p, { method: 'DELETE' });
