import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import {
  registerPatient,
  registerDoctor,
  registerPharmacist,
  registerAdmin,
} from './auth.service';
import { hardDeleteUserById } from './userDeletion.service';

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
  prev_hash: string | null;
  entry_hash: string;
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

export interface AdminOverview {
  activeSessions: number;
  recentLogins: number;
  flaggedEvents: number;
  pendingDoctors: number;
  totalUsers: number;
  activeUsers: number;
  pendingDocumentRequests: number;
  latestAuditEvents: AuditLogRow[];
  recentRegistrations: UserRow[];
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: 'patient' | 'doctor' | 'pharmacist' | 'admin';
  dateOfBirth?: string;
  specialty?: string;
  pharmacy?: string;
}

export async function listPendingDoctors(): Promise<DoctorRegistrationRow[]> {
  try {
      const [rows] = await pool.execute<DoctorRegistrationRow[]>(
        `SELECT u.id, u.email, d.full_name, d.specialty, u.created_at, u.is_active, u.approval_status
         FROM users u
         JOIN doctor d ON d.id = u.id
         WHERE u.role = 'doctor' AND u.approval_status = 'pending' AND u.deleted_at IS NULL
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
      await pool.execute("UPDATE users SET approval_status = 'approved', is_active = TRUE WHERE id = ? AND deleted_at IS NULL", [id]);
    await pool.execute('UPDATE doctor SET approved_by = ? WHERE id = ?', [adminId, id]);
    return true;
  } catch (err) {
    logger.error('Failed to approve doctor registration', { err, id });
    return false;
  }
}

export async function rejectDoctor(id: number): Promise<boolean> {
  try {
      await pool.execute("UPDATE users SET approval_status = 'rejected', is_active = FALSE WHERE id = ? AND deleted_at IS NULL", [id]);
    return true;
  } catch (err) {
    logger.error('Failed to reject doctor registration', { err, id });
    return false;
  }
}

export async function createUser(input: CreateUserInput): Promise<boolean> {
  try {
    switch (input.role) {
      case 'patient':
        await registerPatient({
          name: input.name,
          email: input.email,
          password: input.password,
          dateOfBirth: input.dateOfBirth!,
        }, { requireEmailVerification: false });
        break;

      case 'doctor':
        await registerDoctor({
          name: input.name,
          email: input.email,
          password: input.password,
          specialty: input.specialty,
        }, { requireEmailVerification: false });
        break;

      case 'pharmacist':
        await registerPharmacist({
          name: input.name,
          email: input.email,
          password: input.password,
          pharmacy: input.pharmacy,
        }, { requireEmailVerification: false });
        break;

      case 'admin':
        await registerAdmin({
          name: input.name,
          email: input.email,
          password: input.password,
        }, { requireEmailVerification: false });
        break;
    }

    return true;
  } catch (err) {
    logger.error('Failed to create user', { err });

    return false;
  }
}

export async function listUsers(): Promise<UserRow[]> {
  try {
      const [rows] = await pool.execute<UserRow[]>(
        `SELECT id, email, role, is_active, created_at
         FROM users
         WHERE deleted_at IS NULL
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
      await pool.execute('UPDATE users SET is_active = ? WHERE id = ? AND deleted_at IS NULL', [isActive, id]);
    return true;
  } catch (err) {
    logger.error('Failed to update user status', { err, id, isActive });
    return false;
  }
}

export async function deleteUser(id: number): Promise<boolean> {
  try {
    return await hardDeleteUserById(id);
  } catch (err) {
    logger.error('Failed to delete user', { err, id });
    return false;
  }
}

export async function listAuditLogs(): Promise<AuditLogRow[]> {
  try {
    const [rows] = await pool.execute<AuditLogRow[]>(
      `SELECT id, user_id, role, action, target, ip_address, result, prev_hash, entry_hash, created_at
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

export async function getAdminOverview(): Promise<AdminOverview> {
  try {
    const [
      [activeRows],
      [recentRows],
      [flaggedRows],
      [pendingDoctorRows],
      [totalUserRows],
      [activeUserRows],
      [pendingRequestRows],
      [latestAuditEvents],
      [recentRegistrations],
    ] = await Promise.all([
      pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS count FROM sessions'),
      pool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) AS count FROM auditlog WHERE action = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)',
        ['login'],
      ),
      pool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) AS count FROM auditlog WHERE result = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)',
        ['failure'],
      ),
        pool.execute<RowDataPacket[]>(
          "SELECT COUNT(*) AS count FROM users WHERE role = 'doctor' AND approval_status = 'pending' AND deleted_at IS NULL",
        ),
        pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS count FROM users WHERE deleted_at IS NULL'),
        pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS count FROM users WHERE is_active = TRUE AND deleted_at IS NULL'),
      pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS count FROM document_request WHERE status = 'pending'"),
      pool.execute<AuditLogRow[]>(
        `SELECT id, user_id, role, action, target, ip_address, result, prev_hash, entry_hash, created_at
         FROM auditlog
         ORDER BY id DESC LIMIT 5`,
      ),
        pool.execute<UserRow[]>(
          `SELECT id, email, role, is_active, created_at
           FROM users
           WHERE deleted_at IS NULL
           ORDER BY created_at DESC LIMIT 5`,
      ),
    ]);

    return {
      activeSessions: Number(activeRows[0]?.count ?? 0),
      recentLogins: Number(recentRows[0]?.count ?? 0),
      flaggedEvents: Number(flaggedRows[0]?.count ?? 0),
      pendingDoctors: Number(pendingDoctorRows[0]?.count ?? 0),
      totalUsers: Number(totalUserRows[0]?.count ?? 0),
      activeUsers: Number(activeUserRows[0]?.count ?? 0),
      pendingDocumentRequests: Number(pendingRequestRows[0]?.count ?? 0),
      latestAuditEvents,
      recentRegistrations,
    };
  } catch (err) {
    logger.error('Failed to get admin overview', { err });
    return {
      activeSessions: 0,
      recentLogins: 0,
      flaggedEvents: 0,
      pendingDoctors: 0,
      totalUsers: 0,
      activeUsers: 0,
      pendingDocumentRequests: 0,
      latestAuditEvents: [],
      recentRegistrations: [],
    };
  }
}

export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  try {
    const [rows] = await pool.execute<AnnouncementRow[]>(
      `SELECT id, title, body, created_at
       FROM announcement
       WHERE deleted_at IS NULL
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
    await pool.execute(
      'UPDATE announcement SET title = ?, body = ? WHERE id = ? AND deleted_at IS NULL',
      [input.title.trim(), input.body.trim(), id],
    );
    return true;
  } catch (err) {
    logger.error('Failed to update announcement', { err, id });
    return false;
  }
}

export async function deleteAnnouncement(id: number): Promise<boolean> {
  try {
    await pool.execute(
      'UPDATE announcement SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    return true;
  } catch (err) {
    logger.error('Failed to delete announcement', { err, id });
    return false;
  }
}
