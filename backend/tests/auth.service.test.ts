/**
 * Auth service tests (D1 §9.1, SR2/SR3, FSR5/FSR7) — the security-critical
 * registration + login paths (SDR6). Covers: correct active/inactive state per
 * role, duplicate handling, generic errors (anti-enumeration), timing
 * equalisation, account lockout. DB + password hashing are mocked (no Docker).
 */

jest.mock('../src/db/pool', () => ({
  pool: { getConnection: jest.fn(), execute: jest.fn() },
}));
jest.mock('../src/utils/password', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
  dummyPasswordCompare: jest.fn(),
}));

import { pool } from '../src/db/pool';
import * as password from '../src/utils/password';
import {
  registerPatient,
  registerDoctor,
  registerPharmacist,
  login,
} from '../src/services/auth.service';

const mockGetConnection = pool.getConnection as unknown as jest.Mock;
const mockExecute = pool.execute as unknown as jest.Mock;
const mockHash = password.hashPassword as unknown as jest.Mock;
const mockVerify = password.verifyPassword as unknown as jest.Mock;
const mockDummy = password.dummyPasswordCompare as unknown as jest.Mock;

/** A fake transaction connection for the register functions. */
function mockConn() {
  return {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    execute: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHash.mockResolvedValue('hashed-pw');
  mockDummy.mockResolvedValue(false);
  mockExecute.mockResolvedValue([[]]); // default for SELECT/UPDATE unless overridden
});

// ---------------------------------------------------------------------------
// Registration — correct active state per role (FSR5, §9.8)
// ---------------------------------------------------------------------------
describe('registration', () => {
  it('creates a patient as ACTIVE', async () => {
    const conn = mockConn();
    conn.execute.mockResolvedValueOnce([{ insertId: 5 }]).mockResolvedValueOnce([{}]);
    mockGetConnection.mockResolvedValue(conn);

    const res = await registerPatient({ name: 'Pat', dateOfBirth: '1990-01-01', email: 'p@x.com', password: 'pw' });

    expect(res.id).toBe(5);
    const usersInsert = conn.execute.mock.calls[0][0] as string;
    expect(usersInsert).toMatch(/INSERT INTO users/i);
    expect(usersInsert).toMatch(/'patient'/);
    expect(usersInsert).toMatch(/TRUE/);
    expect(usersInsert).toMatch(/'approved'/i);
    expect(conn.commit).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  it('creates a doctor as INACTIVE (pending approval, FSR5)', async () => {
    const conn = mockConn();
    conn.execute.mockResolvedValueOnce([{ insertId: 6 }]).mockResolvedValueOnce([{}]);
    mockGetConnection.mockResolvedValue(conn);

    await registerDoctor({ name: 'Doc', email: 'd@x.com', password: 'pw', specialty: 'Cardio' });

    const usersInsert = conn.execute.mock.calls[0][0] as string;
    expect(usersInsert).toMatch(/'doctor'/);
    expect(usersInsert).toMatch(/FALSE/);
    expect(usersInsert).toMatch(/'pending'/i);
  });

  it('creates a pharmacist as INACTIVE and writes the pharmacist profile (§9.8)', async () => {
    const conn = mockConn();
    conn.execute.mockResolvedValueOnce([{ insertId: 7 }]).mockResolvedValueOnce([{}]);
    mockGetConnection.mockResolvedValue(conn);

    const res = await registerPharmacist({ name: 'Ph', email: 'ph@x.com', password: 'pw', pharmacy: 'Central' });

    expect(res.id).toBe(7);
    const usersInsert = conn.execute.mock.calls[0][0] as string;
    expect(usersInsert).toMatch(/'pharmacist'/);
    expect(usersInsert).toMatch(/FALSE/); // inactive until an admin approves
    expect(usersInsert).toMatch(/'pending'/i);
    const profileInsert = conn.execute.mock.calls[1][0] as string;
    expect(profileInsert).toMatch(/INSERT INTO pharmacist/i);
    expect(conn.execute.mock.calls[1][1]).toEqual([7, 'Ph', 'Central']);
    expect(conn.commit).toHaveBeenCalled();
  });

  it('rolls back and returns 409 on a duplicate email', async () => {
    const conn = mockConn();
    conn.execute.mockRejectedValueOnce({ errno: 1062, code: 'ER_DUP_ENTRY' });
    mockGetConnection.mockResolvedValue(conn);

    await expect(
      registerPharmacist({ name: 'Ph', email: 'dupe@x.com', password: 'pw' }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Login — authentication rules (SR2, D1 §9.1)
// ---------------------------------------------------------------------------
const userRow = (o: Record<string, unknown> = {}) => ({
  id: 1, password_hash: 'hash', role: 'patient', is_active: 1, failed_logins: 0, locked_until: null, ...o,
});

describe('login', () => {
  it('returns the session user on correct credentials', async () => {
    mockExecute.mockResolvedValueOnce([[userRow()]]);
    mockVerify.mockResolvedValue(true);

    const res = await login('p@x.com', 'pw');

    expect(res).toEqual({ id: 1, role: 'patient', status: 'active', loginAt: expect.any(Number) });
  });

  it('maps an inactive account to status "pending"', async () => {
    mockExecute.mockResolvedValueOnce([[userRow({ is_active: 0, role: 'pharmacist' })]]);
    mockVerify.mockResolvedValue(true);

    const res = await login('ph@x.com', 'pw');

    expect(res.status).toBe('pending');
  });

  it('rejects a wrong password with a generic 401 (no enumeration)', async () => {
    mockExecute.mockResolvedValueOnce([[userRow()]]);
    mockVerify.mockResolvedValue(false);

    await expect(login('p@x.com', 'bad')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password.',
    });
  });

  it('rejects an unknown email with the SAME generic 401 and equalises timing', async () => {
    mockExecute.mockResolvedValueOnce([[]]); // no such user

    await expect(login('nobody@x.com', 'pw')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password.',
    });
    expect(mockDummy).toHaveBeenCalled(); // dummy hash compare → no timing oracle
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('blocks a locked account with 429 before checking the password', async () => {
    mockExecute.mockResolvedValueOnce([[userRow({ locked_until: new Date(Date.now() + 60_000) })]]);

    await expect(login('p@x.com', 'pw')).rejects.toMatchObject({ statusCode: 429 });
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('locks the account after the 5th failed attempt', async () => {
    mockExecute.mockResolvedValueOnce([[userRow({ failed_logins: 4 })]]); // 4 prior fails
    mockVerify.mockResolvedValue(false);

    await expect(login('p@x.com', 'bad')).rejects.toMatchObject({ statusCode: 401 });
    // the follow-up UPDATE should set a lockout window, not just bump the counter
    const updateSql = mockExecute.mock.calls[1][0] as string;
    expect(updateSql).toMatch(/locked_until/i);
  });
});
