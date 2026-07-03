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
