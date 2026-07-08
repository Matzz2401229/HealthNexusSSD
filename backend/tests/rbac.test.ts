/**
 * RBAC middleware tests (D1 §9.2, FSR1/FSR5). Verifies deny-by-default role
 * gating from the server-side session only, that denials are audited (SR14/16),
 * that requireRole itself blocks pending/suspended accounts (closing a real gap
 * where feature routes called requireRole directly without requireActive), and
 * that authorize() composes the fuller guard chain for new routes.
 */
jest.mock('../src/db/pool', () => ({ pool: { execute: jest.fn() } }));
jest.mock('../src/services/audit.service', () => ({ recordAudit: jest.fn() }));

import { Request, Response } from 'express';
import { recordAudit } from '../src/services/audit.service';
import { requireRole, authorize } from '../src/middleware/rbac';

const mockAudit = recordAudit as unknown as jest.Mock;

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

function req(user?: unknown): Request {
  return {
    session: user ? { user } : {},
    method: 'GET',
    originalUrl: '/api/admin',
    ip: '127.0.0.1',
  } as unknown as Request;
}

beforeEach(() => jest.clearAllMocks());

describe('requireRole', () => {
  it('401s when no session user is present', () => {
    const res = mockRes();
    const next = jest.fn();
    requireRole('admin')(req(), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('403s and audits the failure when the role is not allowed', () => {
    const res = mockRes();
    const next = jest.fn();
    requireRole('admin')(req({ id: 3, role: 'patient', status: 'active' }), res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'failure', userId: 3, role: 'patient' }),
    );
  });

  it('403s and audits a PENDING account even when the role matches (FSR5 — the real gap found during manual testing)', () => {
    const res = mockRes();
    const next = jest.fn();
    requireRole('doctor')(req({ id: 5, role: 'doctor', status: 'pending' }), res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ error: expect.stringMatching(/not active/i) });
    expect(next).not.toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'failure', action: 'rbac.inactive_denied', userId: 5 }),
    );
  });

  it('403s a SUSPENDED account even when the role matches', () => {
    const res = mockRes();
    const next = jest.fn();
    requireRole('admin')(req({ id: 9, role: 'admin', status: 'suspended' }), res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when the role is allowed AND the account is active, and does not audit', () => {
    const res = mockRes();
    const next = jest.fn();
    requireRole('admin', 'doctor')(req({ id: 1, role: 'admin', status: 'active' }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockAudit).not.toHaveBeenCalled();
  });
});

describe('authorize (composed guard)', () => {
  const resolver = jest.fn();

  it('always starts with auth and includes the active check by default', () => {
    expect(authorize()).toHaveLength(2); // requireAuth + requireActive
    expect(authorize({ roles: ['admin'] })).toHaveLength(3); // + role
    expect(authorize({ roles: ['doctor'], ownership: { param: 'id', resolver } })).toHaveLength(4); // + ownership
  });

  it('drops the active check only when explicitly opted out (footgun guard)', () => {
    expect(authorize({ roles: ['admin'] })).toHaveLength(3);
    expect(authorize({ roles: ['admin'], active: false })).toHaveLength(2);
  });

  it('the default chain enforces active: a pending account is blocked', () => {
    // chain[1] is requireActive; running it with a pending user must reject.
    const activeGuard = authorize({ roles: ['doctor'] })[1];
    const next = jest.fn();
    expect(() =>
      activeGuard(req({ id: 1, role: 'doctor', status: 'pending' }), mockRes(), next),
    ).toThrow(/not active/i);
    expect(next).not.toHaveBeenCalled();
  });
});
