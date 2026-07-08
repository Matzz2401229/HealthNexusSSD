/**
 * Auth guard tests (middleware/auth.ts): requireAuth + requireActive (SR1, FSR5).
 * Pure server-side session checks — no DB — so nothing is mocked. requireActive
 * is what blocks a *pending* (unapproved) or *suspended* account from any
 * protected route.
 */
import { Request, Response } from 'express';
import { requireAuth, requireActive } from '../src/middleware/auth';

const noop = {} as Response;
const reqWith = (user?: unknown): Request =>
  ({ session: user ? { user } : {} } as unknown as Request);

describe('requireAuth', () => {
  it('throws 401 when there is no session user', () => {
    expect(() => requireAuth(reqWith(), noop, jest.fn())).toThrow(/authentication required/i);
  });

  it('calls next() for an authenticated user', () => {
    const next = jest.fn();
    requireAuth(reqWith({ id: 1, role: 'patient', status: 'active' }), noop, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('requireActive (blocks pending/suspended — FSR5)', () => {
  it('throws 401 when unauthenticated', () => {
    expect(() => requireActive(reqWith(), noop, jest.fn())).toThrow(/authentication required/i);
  });

  it('throws 403 for a pending account', () => {
    expect(() =>
      requireActive(reqWith({ id: 1, role: 'doctor', status: 'pending' }), noop, jest.fn()),
    ).toThrow(/not active/i);
  });

  it('throws 403 for a suspended account', () => {
    expect(() =>
      requireActive(reqWith({ id: 1, role: 'admin', status: 'suspended' }), noop, jest.fn()),
    ).toThrow(/not active/i);
  });

  it('calls next() for an active account', () => {
    const next = jest.fn();
    requireActive(reqWith({ id: 1, role: 'patient', status: 'active' }), noop, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
