/**
 * Tiny fetch wrapper for the HealthNexus API.
 * Calls go to /api/* — in dev Vite proxies that to the backend; in production
 * nginx routes it. credentials:'include' sends the session cookie once real
 * auth exists.
 */
const BASE = '/api';

export async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return res.json();
}

/**
 * Anti-CSRF token for state-changing requests (double-submit, FSR12): the
 * server compares this cookie against the x-csrf-token header. We ensure a
 * token exists client-side; once the auth workstream issues server-side
 * tokens, this reads that cookie instead.
 */
function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  const token = crypto.randomUUID();
  document.cookie = `csrf_token=${token}; path=/; SameSite=Strict`;
  return token;
}

export async function apiPatch(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': getCsrfToken(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return res.json();
}
