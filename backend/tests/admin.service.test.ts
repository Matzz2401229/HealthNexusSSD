jest.mock('../src/db/pool', () => ({
  pool: { execute: jest.fn() },
}));

jest.mock('../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../src/services/auth.service', () => ({
  registerPatient: jest.fn(),
  registerDoctor: jest.fn(),
  registerPharmacist: jest.fn(),
  registerAdmin: jest.fn(),
}));

import { pool } from '../src/db/pool';
import { deleteAnnouncement, deleteUser, listAnnouncements, updateAnnouncement } from '../src/services/admin.service';

const mockExecute = pool.execute as unknown as jest.Mock;

describe('admin soft deletes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockResolvedValue([{}]);
  });

  it('deactivates users instead of deleting user rows', async () => {
    await expect(deleteUser(7)).resolves.toBe(true);

    expect(mockExecute.mock.calls[0][0]).toMatch(/UPDATE users/i);
    expect(mockExecute.mock.calls[0][0]).toMatch(/SET is_active = FALSE/i);
    expect(mockExecute.mock.calls[0][0]).toMatch(/deleted_at = NOW\(\)/i);
    expect(mockExecute.mock.calls[0][0]).toMatch(/deleted_at IS NULL/i);
    expect(mockExecute.mock.calls[0][0]).not.toMatch(/DELETE FROM users/i);
  });

  it('soft-deletes announcements and excludes deleted rows from reads and updates', async () => {
    await expect(deleteAnnouncement(3)).resolves.toBe(true);
    expect(mockExecute.mock.calls[0][0]).toMatch(/UPDATE announcement SET deleted_at = NOW\(\)/i);

    mockExecute.mockClear();
    await listAnnouncements();
    expect(mockExecute.mock.calls[0][0]).toMatch(/WHERE deleted_at IS NULL/i);

    mockExecute.mockClear();
    await updateAnnouncement(3, { title: 'Notice', body: 'Body' });
    expect(mockExecute.mock.calls[0][0]).toMatch(/WHERE id = \? AND deleted_at IS NULL/i);
  });
});
