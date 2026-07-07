/**
 * Tiny fetch wrapper for the HealthNexus API.
 * Calls go to /api/* — in dev Vite proxies that to the backend; in production
 * nginx routes it. credentials:'include' sends the session cookie (hn.sid).
 * On a non-2xx response we throw an Error carrying the server's message + status
 * so pages can show it.
 */
const BASE = '/api';

/**
 * Anti-CSRF token for state-changing requests (double-submit, FSR12): the
 * server compares this cookie against the x-csrf-token header. We provision one
 * client-side; SameSite=Strict is what actually blocks cross-site requests.
 */
export function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  const token = crypto.randomUUID();
  document.cookie = `csrf_token=${token}; path=/; SameSite=Strict`;
  return token;
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
  const token = getCsrfToken();

  return parse(
    await fetch(`${BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
      body: JSON.stringify(body ?? {}),
    }),
  );
}

export async function apiPatch(path, body) {
  return parse(
    await fetch(`${BASE}${path}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
      body: JSON.stringify(body ?? {}),
    }),
  );
}

export async function apiUploadRaw(path, file, headers = {}) {
  return parse(
    await fetch(`${BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-csrf-token': getCsrfToken(),
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
  return parse(
    await fetch(`${BASE}${path}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'x-csrf-token': getCsrfToken() },
    }),
  );
}

export async function apiPut(url, body) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error("Request failed");
  return res.json();
}