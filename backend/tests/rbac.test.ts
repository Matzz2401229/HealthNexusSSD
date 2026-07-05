/**
 * RBAC middleware tests (D1 §9.2). Verifies deny-by-default and role gating
 * using the server-side req.user only.
 */
import { Request, Response } from 'express';
import { requireRole } from '../src/middleware/rbac';

function mockRes() {
  const res = {} as Response & { statusCode?: number; body?: unknown };
  res.status = ((code: number) => {
    res.statusCode = code;
    return res;
  }) as Response['status'];
  res.json = ((body: unknown) => {
    res.body = body;
    return res;
  }) as Response['json'];
  return res;
}

describe('requireRole', () => {
  it('401s when no session user is present', () => {
    const req = { session: {} } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();
    requireRole('admin')(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('403s when the role is not allowed', () => {
    const req = { session: { user: { id: 1, role: 'patient' } } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();
    requireRole('admin')(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when the role is allowed', () => {
    const req = { session: { user: { id: 1, role: 'admin' } } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();
    requireRole('admin', 'doctor')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
