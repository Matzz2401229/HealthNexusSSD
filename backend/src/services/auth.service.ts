import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../db/pool';
import { AppError } from '../utils/AppError';
import { SessionUser } from '../types/session';
import {
  hashPassword,
  verifyPassword,
  dummyPasswordCompare,
} from '../utils/password';

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

interface UserAuthRow extends RowDataPacket {
  id: number;
  password_hash: string;
  role: SessionUser['role'];
  is_active: number; // MySQL BOOLEAN comes back as 0/1
  failed_logins: number;
  locked_until: Date | null;
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
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES (?, ?, 'patient', TRUE)`,
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
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES (?, ?, 'doctor', FALSE)`,
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

/** Authenticate by email + password (FR3, SR2). */
export async function login(
  rawEmail: string,
  password: string,
): Promise<SessionUser> {
  const email = normaliseEmail(rawEmail);

  const [rows] = await pool.execute<UserAuthRow[]>(
    `SELECT id, password_hash, role, is_active, failed_logins, locked_until
     FROM users
     WHERE email = ?
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
  return { id: user.id, role: user.role, status, loginAt: Date.now() }; // NFSR5
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

function translateInsertError(err: unknown): Error {
  const e = err as { errno?: number; code?: string };
  if (e && (e.errno === 1062 || e.code === 'ER_DUP_ENTRY')) {
    return new AppError(409, 'An account with those details already exists.');
  }
  return err as Error;
}