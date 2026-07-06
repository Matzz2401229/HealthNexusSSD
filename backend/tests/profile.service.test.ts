/**
 * Profile service tests (FR4, D1 9.1). Verifies the role-based field
 * allowlist and the current-password re-check on password change — both are
 * server-side gates that must hold even if a client sends unexpected fields.
 */
import { pool } from '../src/db/pool';
import * as profileService from '../src/services/profile.service';
import { hashPassword } from '../src/utils/password';

jest.mock('../src/db/pool', () => ({
  pool: { execute: jest.fn() },
}));

const mockedExecute = pool.execute as jest.Mock;

describe('getProfile', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns the role-joined profile for a valid user', async () => {
    mockedExecute.mockResolvedValueOnce([
      [
        {
          id: 1,
          email: 'pat@example.com',
          role: 'patient',
          is_active: 1,
          created_at: new Date('2026-01-01'),
          full_name: 'Pat Patient',
          dob: '1990-01-01',
        },
      ],
    ]);

    const profile = await profileService.getProfile(1, 'patient');

    expect(profile).toMatchObject({
      id: 1,
      email: 'pat@example.com',
      role: 'patient',
      isActive: true,
      full_name: 'Pat Patient',
      dob: '1990-01-01',
    });
  });

  it('throws 404 when no profile row is found', async () => {
    mockedExecute.mockResolvedValueOnce([[]]);
    await expect(profileService.getProfile(999, 'patient')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('updateProfile', () => {
  afterEach(() => jest.clearAllMocks());

  it('only writes allowlisted columns for the given role', async () => {
    mockedExecute.mockResolvedValueOnce([{}]);

    // 'specialty' is not in the patient allowlist and must be dropped, even
    // though it would be a valid column on the doctor table.
    await profileService.updateProfile(1, 'patient', {
      full_name: 'New Name',
      specialty: 'Cardiology',
    });

    const [sql, params] = mockedExecute.mock.calls[0];
    expect(sql).toContain('UPDATE patient SET full_name = ?');
    expect(sql).not.toContain('specialty');
    expect(params).toEqual(['New Name', 1]);
  });

  it('throws 400 when no allowlisted fields are provided', async () => {
    await expect(
      profileService.updateProfile(1, 'patient', { specialty: 'Cardiology' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockedExecute).not.toHaveBeenCalled();
  });
});

describe('changePassword', () => {
  afterEach(() => jest.clearAllMocks());

  it('rejects when the current password does not match', async () => {
    const hash = await hashPassword('Correct-Passw0rd!');
    mockedExecute.mockResolvedValueOnce([[{ password_hash: hash }]]);

    await expect(
      profileService.changePassword(1, 'wrong-password', 'New-Str0ng!Pass'),
    ).rejects.toMatchObject({ statusCode: 401 });

    // Only the SELECT should have run — no UPDATE on a failed re-check.
    expect(mockedExecute).toHaveBeenCalledTimes(1);
  });

  it('updates the password hash when the current password matches', async () => {
    const hash = await hashPassword('Correct-Passw0rd!');
    mockedExecute
      .mockResolvedValueOnce([[{ password_hash: hash }]])
      .mockResolvedValueOnce([{}]);

    await profileService.changePassword(1, 'Correct-Passw0rd!', 'New-Str0ng!Pass');

    expect(mockedExecute).toHaveBeenCalledTimes(2);
    const [updateSql, updateParams] = mockedExecute.mock.calls[1];
    expect(updateSql).toContain('UPDATE users SET password_hash = ?');
    expect(updateParams[1]).toBe(1);
  });
});
