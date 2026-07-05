import { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';

export interface DoctorRegistrationRow extends RowDataPacket {
  id: number;
  email: string;
  full_name: string;
  specialty: string | null;
  created_at: string;
  is_active: number;
}

export interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  role: string;
  is_active: number;
  created_at: string;
}

export interface AuditLogRow extends RowDataPacket {
  id: number;
  user_id: number | null;
  role: string | null;
  action: string;
  target: string | null;
  ip_address: string | null;
  result: string;
  created_at: string;
}

export interface AnnouncementRow extends RowDataPacket {
  id: number;
  title: string;
  body: string;
  created_at: string;
}

export interface ActivitySummary {
  activeSessions: number;
  recentLogins: number;
  flaggedEvents: number;
}

export async function listPendingDoctors(): Promise<DoctorRegistrationRow[]> {
  try {
    const [rows] = await pool.execute<DoctorRegistrationRow[]>(
      `SELECT u.id, u.email, d.full_name, d.specialty, u.created_at, u.is_active, u.approval_status
       FROM users u
       JOIN doctor d ON d.id = u.id
       WHERE u.role = 'doctor' AND u.approval_status = 'pending'
       ORDER BY u.created_at DESC`,
    );
    return rows;
  } catch (err) {
    logger.error('Failed to list pending doctors', { err });
    return [];
  }
}

export async function approveDoctor(
  id: number,
  adminId: number
): Promise<boolean> {
  try {
    await pool.execute("UPDATE users SET approval_status = 'approved', is_active = TRUE WHERE id = ?", [id]);
    await pool.execute('UPDATE doctor SET approved_by = ? WHERE id = ?', [adminId, id]);
    return true;
  } catch (err) {
    logger.error('Failed to approve doctor registration', { err, id });
    return false;
  }
}

export async function rejectDoctor(id: number): Promise<boolean> {
  try {
    await pool.execute("UPDATE users SET approval_status = 'rejected', is_active = FALSE WHERE id = ?", [id]);
    return true;
  } catch (err) {
    logger.error('Failed to reject doctor registration', { err, id });
    return false;
  }
}

export async function listUsers(): Promise<UserRow[]> {
  try {
    const [rows] = await pool.execute<UserRow[]>(
      `SELECT id, email, role, is_active, created_at
       FROM users
       ORDER BY created_at DESC LIMIT 200`,
    );
    return rows;
  } catch (err) {
    logger.error('Failed to list users', { err });
    return [];
  }
}

export async function updateUserStatus(id: number, isActive: boolean): Promise<boolean> {
  try {
    await pool.execute('UPDATE users SET is_active = ? WHERE id = ?', [isActive, id]);
    return true;
  } catch (err) {
    logger.error('Failed to update user status', { err, id, isActive });
    return false;
  }
}

export async function deleteUser(id: number): Promise<boolean> {
  try {
    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    return true;
  } catch (err) {
    logger.error('Failed to delete user', { err, id });
    return false;
  }
}

export async function listAuditLogs(): Promise<AuditLogRow[]> {
  try {
    const [rows] = await pool.execute<AuditLogRow[]>(
      `SELECT id, user_id, role, action, target, ip_address, result, created_at
       FROM auditlog
       ORDER BY id DESC LIMIT 100`,
    );
    return rows;
  } catch (err) {
    logger.error('Failed to list audit logs', { err });
    return [];
  }
}

export async function getActivitySummary(): Promise<ActivitySummary> {
  try {
    const [activeRows] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS count FROM sessions');
    const [recentRows] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS count FROM auditlog WHERE action = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)',
      ['login'],
    );
    const [flaggedRows] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS count FROM auditlog WHERE result = ?',
      ['failure'],
    );
    return {
      activeSessions: Number(activeRows[0]?.count ?? 0),
      recentLogins: Number(recentRows[0]?.count ?? 0),
      flaggedEvents: Number(flaggedRows[0]?.count ?? 0),
    };
  } catch (err) {
    logger.error('Failed to get activity summary', { err });
    return { activeSessions: 0, recentLogins: 0, flaggedEvents: 0 };
  }
}

export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  try {
    const [rows] = await pool.execute<AnnouncementRow[]>(
      `SELECT id, title, body, created_at
       FROM announcement
       ORDER BY id DESC LIMIT 100`,
    );
    return rows;
  } catch (err) {
    logger.error('Failed to list announcements', { err });
    return [];
  }
}

export async function createAnnouncement(input: { title: string; body: string }, authorId: number): Promise<boolean> {
  try {
    await pool.execute(
      'INSERT INTO announcement (author_id, title, body, created_at) VALUES (?, ?, ?, NOW())',
      [authorId, input.title.trim(), input.body.trim()],
    );
    return true;
  } catch (err) {
    logger.error('Failed to create announcement', { err });
    return false;
  }
}

export async function updateAnnouncement(id: number, input: { title: string; body: string }): Promise<boolean> {
  try {
    await pool.execute('UPDATE announcement SET title = ?, body = ? WHERE id = ?', [input.title.trim(), input.body.trim(), id]);
    return true;
  } catch (err) {
    logger.error('Failed to update announcement', { err, id });
    return false;
  }
}
