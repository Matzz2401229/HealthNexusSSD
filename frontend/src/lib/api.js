/**
 * Tiny fetch wrapper for the HealthNexus API.
 * Calls go to /api/* — in dev Vite proxies that to the backend; in production
 * nginx routes it. credentials:'include' sends the session cookie (hn.sid).
 * On a non-2xx response we throw an Error carrying the server's message + status
 * so pages can show it.
 */
const BASE = '/api';

/**
 * Anti-CSRF token for state-changing requests: the server issues a token,
 * stores its hash in the server-side session, and compares the readable cookie
 * against the x-csrf-token header.
 */
export function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  return '';
}

export async function ensureCsrfToken() {
  // Always refresh before unsafe requests. A browser can keep an old readable
  // csrf_token after Docker/backend restarts while the server-side session hash
  // is gone; reissuing keeps the cookie/header/session triplet in sync.
  const data = await apiGet('/auth/csrf');
  return data.csrfToken || getCsrfToken();
}

async function parse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function apiGet(path) {
  return parse(await fetch(`${BASE}${path}`, { credentials: 'include' }));
}

export async function apiPost(path, body) {
  const token = await ensureCsrfToken();

  return parse(
    await fetch(`${BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
      body: JSON.stringify(body ?? {}),
    }),
  );
}

export async function apiPatch(path, body) {
  const token = await ensureCsrfToken();
  return parse(
    await fetch(`${BASE}${path}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
      body: JSON.stringify(body ?? {}),
    }),
  );
}

export async function apiUploadRaw(path, file, headers = {}) {
  const token = await ensureCsrfToken();
  return parse(
    await fetch(`${BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-csrf-token': token,
        ...headers,
      },
      body: file,
    }),
  );
}

export async function apiDownload(path) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }

  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/i);

  return {
    blob,
    filename: match?.[1] || 'document.bin',
    contentType: res.headers.get('content-type') || 'application/octet-stream',
  };
}

export async function apiDelete(path) {
  const token = await ensureCsrfToken();
  return parse(
    await fetch(`${BASE}${path}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'x-csrf-token': token },
    }),
  );
}

export async function apiPut(path, body) {
  const token = await ensureCsrfToken();
  return parse(
    await fetch(`${BASE}${path}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
      body: JSON.stringify(body ?? {}),
    }),
  );
}
