jest.mock('../src/db/pool', () => ({
  pool: { execute: jest.fn(), getConnection: jest.fn() },
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
const mockGetConnection = pool.getConnection as unknown as jest.Mock;
const mockConn = {
  beginTransaction: jest.fn(),
  execute: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
};

describe('admin user removal and announcement soft deletes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockResolvedValue([{}]);
    mockGetConnection.mockResolvedValue(mockConn);
    mockConn.beginTransaction.mockResolvedValue(undefined);
    mockConn.execute.mockResolvedValue([{}]);
    mockConn.commit.mockResolvedValue(undefined);
    mockConn.rollback.mockResolvedValue(undefined);
  });

  it('removes user rows after cleaning dependent data so emails can be reused', async () => {
    mockConn.execute.mockResolvedValueOnce([[{ email: 'removed@example.test' }]]);

    await expect(deleteUser(7)).resolves.toBe(true);

    const queries = mockConn.execute.mock.calls.map((call) => call[0]).join('\n');
    expect(mockConn.beginTransaction).toHaveBeenCalled();
    expect(queries).toMatch(/SELECT id, email FROM users/i);
    expect(queries).toMatch(/DELETE FROM sessions/i);
    expect(queries).toMatch(/DELETE FROM email_verification_code/i);
    expect(queries).toMatch(/DELETE FROM document_request/i);
    expect(queries).toMatch(/DELETE FROM medical_document/i);
    expect(queries).toMatch(/DELETE FROM appointment/i);
    expect(queries).toMatch(/DELETE FROM users WHERE id = \?/i);
    expect(mockConn.commit).toHaveBeenCalled();
    expect(mockConn.release).toHaveBeenCalled();
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
