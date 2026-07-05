/**
 * CSRF middleware tests (FSR12, SR19). Covers the double-submit check itself
 * plus the attach/clear helpers that pair token issuance to session
 * creation/destruction.
 */
import { Request, Response } from 'express';
import { csrfProtection, attachCsrfToken, clearCsrfToken } from '../src/middleware/csrf';

function mockRes() {
  const res = {} as Response & { statusCode?: number; body?: unknown; cookies: Record<string, unknown> };
  res.cookies = {};
  res.status = ((code: number) => {
    res.statusCode = code;
    return res;
  }) as Response['status'];
  res.json = ((body: unknown) => {
    res.body = body;
    return res;
  }) as Response['json'];
  res.cookie = ((name: string, value: string, options: unknown) => {
    res.cookies[name] = { value, options };
    return res;
  }) as unknown as Response['cookie'];
  res.clearCookie = ((name: string) => {
    delete res.cookies[name];
    return res;
  }) as unknown as Response['clearCookie'];
  return res;
}

describe('attachCsrfToken', () => {
  it('sets a readable (non-httpOnly) cookie with a fresh token', () => {
    const res = mockRes();
    const token = attachCsrfToken(res);

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(res.cookies.csrf_token).toBeDefined();
    const { value, options } = res.cookies.csrf_token as { value: string; options: { httpOnly: boolean } };
    expect(value).toBe(token);
    expect(options.httpOnly).toBe(false);
  });

  it('issues a different token on each call', () => {
    const res = mockRes();
    const first = attachCsrfToken(res);
    const second = attachCsrfToken(res);
    expect(first).not.toBe(second);
  });
});

describe('clearCsrfToken', () => {
  it('clears the csrf cookie', () => {
    const res = mockRes();
    attachCsrfToken(res);
    clearCsrfToken(res);
    expect(res.cookies.csrf_token).toBeUndefined();
  });
});

describe('csrfProtection', () => {
  function mockReqWith(cookieToken?: string, headerToken?: string) {
    return {
      method: 'POST',
      cookies: cookieToken !== undefined ? { csrf_token: cookieToken } : {},
      get: (name: string) => (name.toLowerCase() === 'x-csrf-token' ? headerToken : undefined),
    } as unknown as Request;
  }

  it('allows safe methods through without a token', () => {
    const req = { method: 'GET', cookies: {}, get: () => undefined } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('403s a state-changing request with no token at all', () => {
    const req = mockReqWith(undefined, undefined);
    const res = mockRes();
    const next = jest.fn();
    csrfProtection(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('403s when the cookie and header tokens do not match', () => {
    const req = mockReqWith('token-a', 'token-b');
    const res = mockRes();
    const next = jest.fn();
    csrfProtection(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through when the cookie and header tokens match', () => {
    const req = mockReqWith('same-token', 'same-token');
    const res = mockRes();
    const next = jest.fn();
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
