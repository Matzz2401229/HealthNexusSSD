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
  validatePasswordPolicy: jest.fn(),
}));
jest.mock('../src/services/email.service', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  canExposeDevelopmentCode: jest.fn().mockReturnValue(true),
}));

import { pool } from '../src/db/pool';
import * as password from '../src/utils/password';
import { canExposeDevelopmentCode, sendEmail } from '../src/services/email.service';
import {
  registerPatient,
  registerDoctor,
  registerPharmacist,
  login,
  requestRegistrationVerificationCode,
  requestPasswordResetCode,
  verifyPasswordResetCode,
  resetPasswordWithToken,
  attachSessionToUser,
} from '../src/services/auth.service';

const mockGetConnection = pool.getConnection as unknown as jest.Mock;
const mockExecute = pool.execute as unknown as jest.Mock;
const mockHash = password.hashPassword as unknown as jest.Mock;
const mockVerify = password.verifyPassword as unknown as jest.Mock;
const mockDummy = password.dummyPasswordCompare as unknown as jest.Mock;
const mockValidatePolicy = password.validatePasswordPolicy as unknown as jest.Mock;
const mockCanExposeDevelopmentCode = canExposeDevelopmentCode as unknown as jest.Mock;
const mockSendEmail = sendEmail as unknown as jest.Mock;

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
  mockValidatePolicy.mockReturnValue([]);
  mockSendEmail.mockResolvedValue(true);
  mockCanExposeDevelopmentCode.mockReturnValue(true);
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

    const res = await registerPatient(
      { name: 'Pat', dateOfBirth: '1990-01-01', email: 'p@x.com', password: 'pw' },
      { requireEmailVerification: false },
    );

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

    await registerDoctor(
      { name: 'Doc', email: 'd@x.com', password: 'pw', specialty: 'Cardio' },
      { requireEmailVerification: false },
    );

    const usersInsert = conn.execute.mock.calls[0][0] as string;
    expect(usersInsert).toMatch(/'doctor'/);
    expect(usersInsert).toMatch(/FALSE/);
    expect(usersInsert).toMatch(/'pending'/i);
  });

  it('creates a pharmacist as INACTIVE and writes the pharmacist profile (§9.8)', async () => {
    const conn = mockConn();
    conn.execute.mockResolvedValueOnce([{ insertId: 7 }]).mockResolvedValueOnce([{}]);
    mockGetConnection.mockResolvedValue(conn);

    const res = await registerPharmacist(
      { name: 'Ph', email: 'ph@x.com', password: 'pw', pharmacy: 'Central' },
      { requireEmailVerification: false },
    );

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
      registerPharmacist(
        { name: 'Ph', email: 'dupe@x.com', password: 'pw' },
        { requireEmailVerification: false },
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  it('requires email verification for self-registration service calls', async () => {
    await expect(
      registerPatient({ name: 'Pat', dateOfBirth: '1990-01-01', email: 'p@x.com', password: 'pw' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Email verification code is required.',
    });
    expect(mockGetConnection).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Login — authentication rules (SR2, D1 §9.1)
// ---------------------------------------------------------------------------
const userRow = (o: Record<string, unknown> = {}) => ({
  id: 1,
  password_hash: 'hash',
  role: 'patient',
  is_active: 1,
  failed_logins: 0,
  locked_until: null,
  full_name: 'Patient One',
  ...o,
});

describe('login', () => {
  it('returns the session user on correct credentials', async () => {
    mockExecute.mockResolvedValueOnce([[userRow()]]);
    mockVerify.mockResolvedValue(true);

    const res = await login('p@x.com', 'pw');

    expect(res).toEqual({
      id: 1,
      role: 'patient',
      status: 'active',
      fullName: 'Patient One',
      loginAt: expect.any(Number),
    });
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

describe('password reset', () => {
  it('creates a hashed registration code before self-registration', async () => {
    mockExecute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    const res = await requestRegistrationVerificationCode('new@test.com', '127.0.0.1');

    expect(res.message).toMatch(/Verification code sent/i);
    expect(res.developmentCode).toMatch(/^\d{6}$/);
    expect(mockExecute.mock.calls[2][0]).toMatch(/INSERT INTO email_verification_code/i);
    const insertParams = mockExecute.mock.calls[2][1];
    expect(insertParams[1]).toBe('registration');
    expect(insertParams[2]).toMatch(/^[a-f0-9]{64}$/);
  });

  it('does not expose registration development codes when the local-dev gate is off', async () => {
    mockCanExposeDevelopmentCode.mockReturnValueOnce(false);
    mockExecute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    const res = await requestRegistrationVerificationCode('new@test.com', '127.0.0.1');

    expect(res.developmentCode).toBeUndefined();
  });

  it('fails registration code requests when email delivery fails outside local dev', async () => {
    mockCanExposeDevelopmentCode.mockReturnValue(false);
    mockSendEmail.mockResolvedValueOnce(false);
    mockExecute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    await expect(requestRegistrationVerificationCode('new@test.com', '127.0.0.1'))
      .rejects.toMatchObject({ statusCode: 503 });
  });

  it('creates a hashed reset verification code without exposing account existence in the message', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    const res = await requestPasswordResetCode('patient@test.com', '127.0.0.1');

    expect(res.message).toMatch(/If an account exists/i);
    expect(res.developmentCode).toMatch(/^\d{6}$/);
    expect(mockExecute.mock.calls[2][0]).toMatch(/INSERT INTO email_verification_code/i);
    const insertParams = mockExecute.mock.calls[2][1];
    expect(insertParams[1]).toBe('password_reset');
    expect(insertParams[2]).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns the same generic message when the account does not exist', async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const res = await requestPasswordResetCode('missing@test.com', '127.0.0.1');

    expect(res.message).toMatch(/If an account exists/i);
    expect(res.developmentCode).toBeUndefined();
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('verifies the reset code before issuing a reset token', async () => {
    // Use a real generated hash from the same service path by first requesting a code.
    mockExecute
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);
    const requested = await requestPasswordResetCode('patient@test.com', '127.0.0.1');
    const insertedHash = mockExecute.mock.calls[2][1][2];

    mockExecute.mockClear();
    mockExecute
      .mockResolvedValueOnce([[
        {
          id: 11,
          email: 'patient@test.com',
          purpose: 'password_reset',
          code_hash: insertedHash,
          expires_at: new Date(Date.now() + 60_000),
          attempts: 0,
          used_at: null,
        },
      ]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    const res = await verifyPasswordResetCode('patient@test.com', requested.developmentCode!, '127.0.0.1');

    expect(res.resetToken).toBeTruthy();
    expect(mockExecute.mock.calls[0][0]).toMatch(/FROM email_verification_code/i);
    expect(mockExecute.mock.calls[1][0]).toMatch(/UPDATE email_verification_code/i);
    expect(mockExecute.mock.calls[4][0]).toMatch(/INSERT INTO password_reset_token/i);
  });

  it('resets the password, marks the token used, and clears existing sessions', async () => {
    const conn = mockConn();
    mockGetConnection.mockResolvedValue(conn);
    mockExecute.mockResolvedValueOnce([[
      { id: 10, user_id: 1, expires_at: new Date(Date.now() + 60_000), used_at: null },
    ]]);

    const res = await resetPasswordWithToken('valid-token', 'NewPassword123!');

    expect(res).toEqual({ userId: 1 });
    expect(mockValidatePolicy).toHaveBeenCalledWith('NewPassword123!');
    expect(mockHash).toHaveBeenCalledWith('NewPassword123!');
    expect(conn.execute.mock.calls[0][0]).toMatch(/UPDATE users/i);
    expect(conn.execute.mock.calls[1][0]).toMatch(/UPDATE password_reset_token/i);
    expect(conn.execute.mock.calls[2][0]).toMatch(/DELETE FROM sessions/i);
    expect(conn.execute.mock.calls[2][1]).toEqual([1]);
    expect(conn.commit).toHaveBeenCalled();
  });

  it('stores structured session ownership after login', async () => {
    mockExecute.mockResolvedValueOnce([{}]);

    await attachSessionToUser('session-123', 42);

    expect(mockExecute.mock.calls[0][0]).toMatch(/UPDATE sessions/i);
    expect(mockExecute.mock.calls[0][1]).toEqual([42, 'session-123']);
  });

  it('rejects expired or reused reset tokens', async () => {
    mockExecute.mockResolvedValueOnce([[
      { id: 10, user_id: 1, expires_at: new Date(Date.now() - 60_000), used_at: null },
    ]]);

    await expect(resetPasswordWithToken('expired-token', 'NewPassword123!')).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mockHash).not.toHaveBeenCalledWith('NewPassword123!');
  });
});
