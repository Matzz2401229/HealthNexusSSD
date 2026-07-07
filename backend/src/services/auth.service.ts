import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../db/pool';
import { AppError } from '../utils/AppError';
import { SessionUser } from '../types/session';
import {
  hashPassword,
  verifyPassword,
  dummyPasswordCompare,
} from '../utils/password';
import { logger } from '../utils/logger';

/**
 * Authentication service — OWNER: IS (Adil)
 * References: FR1, FR2, FR3, SR2, SR3, FSR5, D1 section 9.1.
 * Matches the team schema: users (login) + patient/doctor (profile).
 */

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const GENERIC_LOGIN_ERROR = 'Invalid email or password.';

export interface RegisterPatientInput {
  name: string;
  dateOfBirth: string; // 'YYYY-MM-DD'
  email: string;
  password: string;
}

export interface RegisterDoctorInput {
  name: string;
  email: string;
  password: string;
  specialty?: string; // Option A: team schema uses specialty, not licence number
}

export interface RegisterPharmacistInput {
  name: string;
  email: string;
  password: string;
  pharmacy?: string; // matches the pharmacist table's `pharmacy` column
}

interface UserAuthRow extends RowDataPacket {
  id: number;
  password_hash: string;
  role: SessionUser['role'];
  is_active: number; // MySQL BOOLEAN comes back as 0/1
  failed_logins: number;
  locked_until: Date | null;
  full_name: string | null;
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Register a patient (FR1): users row (active) + patient profile row. */
export async function registerPatient(
  input: RegisterPatientInput,
): Promise<{ id: number }> {
  const email = normaliseEmail(input.email);
  const passwordHash = await hashPassword(input.password);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [userResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, role, is_active, approval_status)
       VALUES (?, ?, 'patient', TRUE, 'approved')`,
      [email, passwordHash],
    );
    const userId = userResult.insertId;

    await conn.execute<ResultSetHeader>(
      `INSERT INTO patient (id, full_name, dob) VALUES (?, ?, ?)`,
      [userId, input.name, input.dateOfBirth],
    );

    await conn.commit();
    return { id: userId };
  } catch (err) {
    await conn.rollback();
    throw translateInsertError(err);
  } finally {
    conn.release();
  }
}

/**
 * Register a doctor (FR2, FSR5, SR3): users row created INACTIVE
 * (is_active = FALSE) — no privileges until an admin approves — plus a
 * doctor profile row, all in one transaction.
 */
export async function registerDoctor(
  input: RegisterDoctorInput,
): Promise<{ id: number }> {
  const email = normaliseEmail(input.email);
  const passwordHash = await hashPassword(input.password);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [userResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, role, is_active, approval_status)
       VALUES (?, ?, 'doctor', FALSE, 'pending')`,
      [email, passwordHash],
    );
    const userId = userResult.insertId;

    await conn.execute<ResultSetHeader>(
      `INSERT INTO doctor (id, full_name, specialty) VALUES (?, ?, ?)`,
      [userId, input.name, input.specialty ?? null],
    );

    await conn.commit();
    return { id: userId };
  } catch (err) {
    await conn.rollback();
    throw translateInsertError(err);
  } finally {
    conn.release();
  }
}

/**
 * Register a pharmacist (SR3, D1 §9.8): like a doctor, the users row is created
 * INACTIVE (is_active = FALSE) — no privileges until an admin approves — plus a
 * pharmacist profile row, all in one transaction. The Data Control Matrix lists
 * "Approve / Reject pharmacist accounts" as an admin function.
 */
export async function registerPharmacist(
  input: RegisterPharmacistInput,
): Promise<{ id: number }> {
  const email = normaliseEmail(input.email);
  const passwordHash = await hashPassword(input.password);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [userResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, role, is_active, approval_status)
       VALUES (?, ?, 'pharmacist', FALSE, 'pending')`,
      [email, passwordHash],
    );
    const userId = userResult.insertId;

    await conn.execute<ResultSetHeader>(
      `INSERT INTO pharmacist (id, full_name, pharmacy) VALUES (?, ?, ?)`,
      [userId, input.name, input.pharmacy ?? null],
    );

    await conn.commit();
    return { id: userId };
  } catch (err) {
    await conn.rollback();
    throw translateInsertError(err);
  } finally {
    conn.release();
  }
}

export interface RegisterAdminInput {
  name: string;
  email: string;
  password: string;
}

export async function registerAdmin(
  input: RegisterAdminInput,
): Promise<{ id: number }> {
  const email = normaliseEmail(input.email);
  const passwordHash = await hashPassword(input.password);

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [userResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO users
       (email, password_hash, role, is_active, approval_status)
       VALUES (?, ?, 'admin', TRUE, 'approved')`,
      [email, passwordHash],
    );

    const userId = userResult.insertId;

    await conn.execute<ResultSetHeader>(
      `INSERT INTO admin (id, full_name)
       VALUES (?, ?)`,
      [userId, input.name],
    );

    await conn.commit();

    return { id: userId };
  } catch (err) {
    await conn.rollback();
    throw translateInsertError(err);
  } finally {
    conn.release();
  }
}

export interface SuspiciousAccount {
  email: string;
  failedAttempts: number;
}

/** Authenticate by email + password (FR3, SR2). */
export async function login(
  rawEmail: string,
  password: string,
): Promise<SessionUser> {
  const email = normaliseEmail(rawEmail);

  const [rows] = await pool.execute<UserAuthRow[]>(
    `SELECT u.id, u.password_hash, u.role, u.is_active, u.failed_logins, u.locked_until,
            COALESCE(p.full_name, d.full_name, ph.full_name, a.full_name) AS full_name
     FROM users u
     LEFT JOIN patient p ON p.id = u.id
     LEFT JOIN doctor d ON d.id = u.id
     LEFT JOIN pharmacist ph ON ph.id = u.id
     LEFT JOIN admin a ON a.id = u.id
     WHERE u.email = ?
     LIMIT 1`,
    [email],
  );

  const user = rows[0];

  if (!user) {
    await dummyPasswordCompare(password); // equalise timing (anti-enumeration)
    throw new AppError(401, GENERIC_LOGIN_ERROR);
  }

  if (user.locked_until && user.locked_until.getTime() > Date.now()) {
    throw new AppError(429, 'Account temporarily locked. Please try again later.');
  }

  const passwordOk = await verifyPassword(password, user.password_hash);

  if (!passwordOk) {
    await registerFailedAttempt(user.id, user.failed_logins);
    throw new AppError(401, GENERIC_LOGIN_ERROR);
  }

  await pool.execute(
    `UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?`,
    [user.id],
  );

  // Map the team's is_active boolean onto the session status shape.
  const status: SessionUser['status'] = user.is_active ? 'active' : 'pending';
  return { id: user.id, role: user.role, status, fullName: user.full_name, loginAt: Date.now() }; // NFSR5
}

/** Increment failed-login counter; lock at the threshold (D1 9.1). */
async function registerFailedAttempt(
  userId: number,
  currentAttempts: number,
): Promise<void> {
  const nextAttempts = currentAttempts + 1;

  if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
    await pool.execute(
      `UPDATE users
       SET failed_logins = 0,
           locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE)
       WHERE id = ?`,
      [LOCKOUT_MINUTES, userId],
    );
  } else {
    await pool.execute(
      `UPDATE users SET failed_logins = ? WHERE id = ?`,
      [nextAttempts, userId],
    );
  }
}

export async function listSuspiciousAccounts(): Promise<SuspiciousAccount[]> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `
      SELECT
          target AS email,
          COUNT(*) AS failedAttempts
      FROM auditlog
      WHERE action = 'login'
        AND result = 'failure'
        AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY target
      HAVING COUNT(*) >= 5
      ORDER BY failedAttempts DESC
      `
    );

    return rows as SuspiciousAccount[];
  } catch (err) {
    logger.error("Failed to list suspicious accounts", { err });
    return [];
  }
}

function translateInsertError(err: unknown): Error {
  const e = err as { errno?: number; code?: string };
  if (e && (e.errno === 1062 || e.code === 'ER_DUP_ENTRY')) {
    return new AppError(409, 'An account with those details already exists.');
  }
  return err as Error;
}
