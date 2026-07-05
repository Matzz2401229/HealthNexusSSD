import { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool';
import { AppError } from '../utils/AppError';
import { SessionUser } from '../types/session';
import { hashPassword, verifyPassword } from '../utils/password';

/**
 * Profile service (FR4, D1 9.1/9.2 data control matrix).
 * Every query is scoped by the caller's own userId — never a client-supplied
 * id — so a user can only ever read or write their own profile (FSR3).
 */

const ROLE_TABLE: Record<SessionUser['role'], string> = {
  patient: 'patient',
  doctor: 'doctor',
  pharmacist: 'pharmacist',
  admin: 'admin',
};

// Allowlist of role-table columns a user may view/edit on their own profile.
// Hardcoded, not derived from client input — safe to interpolate into SQL.
const ROLE_PROFILE_FIELDS: Record<SessionUser['role'], string[]> = {
  patient: ['full_name', 'dob'],
  doctor: ['full_name', 'specialty'],
  pharmacist: ['full_name', 'pharmacy'],
  admin: ['full_name'],
};

interface ProfileRow extends RowDataPacket {
  id: number;
  email: string;
  role: SessionUser['role'];
  is_active: number;
  created_at: Date;
  [column: string]: unknown;
}

interface PasswordRow extends RowDataPacket {
  password_hash: string;
}

export interface ProfileData {
  id: number;
  email: string;
  role: SessionUser['role'];
  isActive: boolean;
  createdAt: Date;
  [field: string]: unknown;
}

/** Fetch the caller's own profile: core account fields + role-specific fields. */
export async function getProfile(userId: number, role: SessionUser['role']): Promise<ProfileData> {
  const table = ROLE_TABLE[role];
  const roleCols = ROLE_PROFILE_FIELDS[role];
  const selectCols = roleCols.map((c) => `p.${c}`).join(', ');

  const [rows] = await pool.execute<ProfileRow[]>(
    `SELECT u.id, u.email, u.role, u.is_active, u.created_at, ${selectCols}
     FROM users u
     JOIN ${table} p ON p.id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [userId],
  );

  const row = rows[0];
  if (!row) {
    throw new AppError(404, 'Profile not found.');
  }

  const { id, email, role: userRole, is_active, created_at, ...roleFields } = row;
  return {
    id,
    email,
    role: userRole,
    isActive: !!is_active,
    createdAt: created_at,
    ...roleFields,
  };
}

/**
 * Update the caller's own role-specific profile fields (FR4). `fields` is
 * filtered against the role's allowlist here — the server-side gate, not the
 * request schema, is what prevents writing to columns outside the allowlist.
 */
export async function updateProfile(
  userId: number,
  role: SessionUser['role'],
  fields: Record<string, string | null>,
): Promise<void> {
  const table = ROLE_TABLE[role];
  const allowed = ROLE_PROFILE_FIELDS[role];

  const updates = Object.entries(fields).filter(([key]) => allowed.includes(key));
  if (updates.length === 0) {
    throw new AppError(400, 'No valid profile fields to update.');
  }

  const setClause = updates.map(([key]) => `${key} = ?`).join(', ');
  const values = updates.map(([, value]) => value);

  await pool.execute(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [...values, userId]);
}

/**
 * Change the caller's own password (D1 9.1: current-password re-check before
 * accepting a new one). Password *policy* validation happens in the
 * controller, mirroring registerPatient/registerDoctor.
 */
export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const [rows] = await pool.execute<PasswordRow[]>(
    `SELECT password_hash FROM users WHERE id = ? LIMIT 1`,
    [userId],
  );

  const row = rows[0];
  if (!row) {
    throw new AppError(404, 'User not found.');
  }

  const currentOk = await verifyPassword(currentPassword, row.password_hash);
  if (!currentOk) {
    throw new AppError(401, 'Current password is incorrect.');
  }

  const newHash = await hashPassword(newPassword);
  await pool.execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, userId]);
}
