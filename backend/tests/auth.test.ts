/**
 * Auth middleware tests (D1 9.1). Covers deny-by-default, the FSR5 pending
 * gate, and the NFSR5 absolute session timeout — a session must be rejected
 * and destroyed server-side once 8h have passed since login, even if the
 * user has been continuously active (which only resets the separate idle
 * timeout on the cookie itself).
 */
import { Request, Response } from 'express';
import { requireAuth, requireActive } from '../src/middleware/auth';
import { SessionUser } from '../src/types/session';

function mockReq(user?: SessionUser) {
  return {
    session: {
      user,
      destroy: jest.fn((cb: (err?: unknown) => void) => cb()),
    },
  } as unknown as Request;
}

const HOUR = 60 * 60 * 1000;

function activeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return { id: 1, role: 'patient', status: 'active', loginAt: Date.now(), ...overrides };
}

describe('requireAuth', () => {
  it('401s when there is no session user', () => {
    const req = mockReq(undefined);
    const next = jest.fn();
    expect(() => requireAuth(req, {} as Response, next)).toThrow(
      expect.objectContaining({ statusCode: 401 }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for a fresh session', () => {
    const req = mockReq(activeUser());
    const next = jest.fn();
    requireAuth(req, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects and destroys a session past the 8h absolute timeout (NFSR5)', () => {
    const user = activeUser({ loginAt: Date.now() - 8 * HOUR - 1000 });
    const req = mockReq(user);
    const next = jest.fn();

    expect(() => requireAuth(req, {} as Response, next)).toThrow(
      expect.objectContaining({ statusCode: 401 }),
    );
    expect(next).not.toHaveBeenCalled();
    expect((req.session as unknown as { destroy: jest.Mock }).destroy).toHaveBeenCalledTimes(1);
  });

  it('allows a session just under the 8h boundary', () => {
    const user = activeUser({ loginAt: Date.now() - 8 * HOUR + 1000 });
    const req = mockReq(user);
    const next = jest.fn();
    requireAuth(req, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('requireActive', () => {
  it('403s for a pending account even within the timeout window', () => {
    const req = mockReq(activeUser({ status: 'pending' }));
    const next = jest.fn();
    expect(() => requireActive(req, {} as Response, next)).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('401s (not 403) once the absolute timeout has passed, even for an active account', () => {
    const user = activeUser({ loginAt: Date.now() - 8 * HOUR - 1000 });
    const req = mockReq(user);
    const next = jest.fn();
    expect(() => requireActive(req, {} as Response, next)).toThrow(
      expect.objectContaining({ statusCode: 401 }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for an active, non-expired session', () => {
    const req = mockReq(activeUser());
    const next = jest.fn();
    requireActive(req, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
