jest.mock('../src/db/pool', () => ({
  pool: { getConnection: jest.fn() },
}));

jest.mock('../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

import { pool } from '../src/db/pool';
import { recordAudit } from '../src/services/audit.service';

const mockGetConnection = pool.getConnection as unknown as jest.Mock;

function mockConnection() {
  return {
    query: jest.fn(),
    execute: jest.fn(),
    release: jest.fn(),
  };
}

describe('recordAudit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when the immutable audit entry cannot be written', async () => {
    const conn = mockConnection();
    conn.query
      .mockResolvedValueOnce([[{ acquired: 1 }]])
      .mockResolvedValueOnce([[{ entry_hash: 'previous' }]])
      .mockResolvedValueOnce([{}]);
    conn.execute.mockRejectedValueOnce(new Error('insert denied'));
    mockGetConnection.mockResolvedValueOnce(conn);

    await expect(recordAudit({
      userId: 1,
      role: 'admin',
      action: 'admin.create_user',
      target: 'user:test',
      result: 'success',
    })).rejects.toThrow('insert denied');

    expect(conn.release).toHaveBeenCalledTimes(1);
  });
});
