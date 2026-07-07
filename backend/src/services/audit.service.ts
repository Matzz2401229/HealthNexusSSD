/**
 * Append-only, hash-chained audit log.
 * Records security-relevant actions without storing passwords, tokens,
 * request bodies, or clinical content.
 */
import crypto from 'crypto';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';

export type AuditResult = 'success' | 'failure';

export interface AuditEvent {
  userId: number | null;
  role: string | null;
  action: string;
  target?: string;
  ip?: string;
  result: AuditResult;
}

interface AuditHashPayload {
  prevHash: string;
  userId: number | null;
  role: string | null;
  action: string;
  target: string | null;
  ip: string | null;
  result: AuditResult;
  createdAt: string;
}

function toSqlUtcTimestamp(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function hashEntry(payload: AuditHashPayload): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

/**
 * Adds one immutable audit event to the hash chain.
 * The MySQL advisory lock prevents two requests from creating separate chains.
 */
export async function recordAudit(event: AuditEvent): Promise<void> {
  const connection = await pool.getConnection();
  const lockName = 'healthnexus_audit_chain';

  try {
    const [lockRows] = await connection.query(
      'SELECT GET_LOCK(?, 5) AS acquired',
      [lockName],
    );

    const acquired = (lockRows as Array<{ acquired: number }>)[0]?.acquired === 1;

    if (!acquired) {
      throw new Error('Could not obtain audit-log lock.');
    }

    const [previousRows] = await connection.query(
      'SELECT entry_hash FROM auditlog ORDER BY id DESC LIMIT 1',
    );

    const prevHash =
      (previousRows as Array<{ entry_hash: string }>)[0]?.entry_hash ?? '';

    const createdAt = toSqlUtcTimestamp();
    const payload: AuditHashPayload = {
      prevHash,
      userId: event.userId,
      role: event.role,
      action: event.action,
      target: event.target ?? null,
      ip: event.ip ?? null,
      result: event.result,
      createdAt,
    };

    const entryHash = hashEntry(payload);

    await connection.execute(
      `INSERT INTO auditlog
        (user_id, role, action, target, ip_address, result, prev_hash, entry_hash, created_at)
       VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.userId,
        payload.role,
        payload.action,
        payload.target,
        payload.ip,
        payload.result,
        payload.prevHash || null,
        entryHash,
        payload.createdAt,
      ],
    );
  } catch (err) {
    logger.error('Failed to write audit entry', {
      action: event.action,
      error: err instanceof Error ? err.message : 'Unknown audit error',
    });
  } finally {
    try {
      await connection.query('DO RELEASE_LOCK(?)', [lockName]);
    } catch {
      // Connection release will also release any remaining advisory lock.
    }

    connection.release();
  }
}