/**
 * Append-only, hash-chained audit log (D1 §9.3, SR14/SR16/SR17).
 * Each entry stores SHA-256(prev_hash + serialised entry), forming a tamper-
 * evident chain. NEVER log passwords, tokens, or clinical content.
 *
 * SKELETON: persistence to the `auditlog` table is stubbed with a parameterised
 * INSERT sketch; wire it up in the Admin & audit workstream.
 */
import crypto from 'crypto';
import { query } from '../db/pool';
import { logger } from '../utils/logger';

export interface AuditEvent {
  userId: number | null;
  role: string | null;
  action: string;           // e.g. 'login', 'record.access', 'prescription.fulfil'
  target?: string;          // resource identifier, never resource content
  ip?: string;
  result: 'success' | 'failure';
}

function hashEntry(prevHash: string, event: AuditEvent, ts: string): string {
  const payload = JSON.stringify({ prevHash, ...event, ts });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export async function recordAudit(event: AuditEvent): Promise<void> {
  try {
    const prev = await query<{ entry_hash: string }>(
      'SELECT entry_hash FROM auditlog ORDER BY id DESC LIMIT 1',
    );
    const prevHash = prev[0]?.entry_hash ?? '';
    const ts = new Date().toISOString();
    const entryHash = hashEntry(prevHash, event, ts);

    await query(
      `INSERT INTO auditlog (user_id, role, action, target, ip_address, result, prev_hash, entry_hash)
       VALUES (:userId, :role, :action, :target, :ip, :result, :prevHash, :entryHash)`,
      {
        userId: event.userId,
        role: event.role,
        action: event.action,
        target: event.target ?? null,
        ip: event.ip ?? null,
        result: event.result,
        prevHash,
        entryHash,
      },
    );
  } catch (err) {
    // Audit failures must be visible but must not crash the request path.
    console.error(err);
    logger.error('Failed to write audit entry', { action: event.action });
  }
}
