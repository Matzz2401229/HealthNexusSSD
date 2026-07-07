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

function mockReq(method = 'POST') {
  return {
    method,
    cookies: {},
    session: {},
    secure: false,
    get: () => undefined,
  } as unknown as Request;
}

describe('attachCsrfToken', () => {
  it('sets a readable (non-httpOnly) cookie with a fresh token', () => {
    const req = mockReq();
    const res = mockRes();
    const token = attachCsrfToken(req, res);

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(req.session.csrfTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(res.cookies.csrf_token).toBeDefined();
    const { value, options } = res.cookies.csrf_token as { value: string; options: { httpOnly: boolean } };
    expect(value).toBe(token);
    expect(options.httpOnly).toBe(false);
    expect(options.secure).toBe(false);
  });

  it('marks the csrf cookie secure only for HTTPS/proxied HTTPS requests', () => {
    const req = {
      ...mockReq(),
      secure: false,
      get: (name: string) => (name.toLowerCase() === 'x-forwarded-proto' ? 'https' : undefined),
    } as unknown as Request;
    const res = mockRes();

    attachCsrfToken(req, res);

    const { options } = res.cookies.csrf_token as { options: { secure: boolean } };
    expect(options.secure).toBe(true);
  });

  it('issues a different token on each call', () => {
    const req = mockReq();
    const res = mockRes();
    const first = attachCsrfToken(req, res);
    const second = attachCsrfToken(req, res);
    expect(first).not.toBe(second);
  });
});

describe('clearCsrfToken', () => {
  it('clears the csrf cookie', () => {
    const req = mockReq();
    const res = mockRes();
    attachCsrfToken(req, res);
    clearCsrfToken(res);
    expect(res.cookies.csrf_token).toBeUndefined();
  });
});

describe('csrfProtection', () => {
  function mockReqWith(cookieToken?: string, headerToken?: string, sessionTokenHash?: string) {
    return {
      method: 'POST',
      cookies: cookieToken !== undefined ? { csrf_token: cookieToken } : {},
      session: { csrfTokenHash: sessionTokenHash },
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
    const issuingReq = mockReq();
    const issuingRes = mockRes();
    const token = attachCsrfToken(issuingReq, issuingRes);
    const req = mockReqWith(token, token, issuingReq.session.csrfTokenHash);
    const res = mockRes();
    const next = jest.fn();
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
