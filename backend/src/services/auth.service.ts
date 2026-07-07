import crypto from 'crypto';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../db/pool';
import { AppError } from '../utils/AppError';
import { SessionUser } from '../types/session';
import { config } from '../config/env';
import {
  hashPassword,
  verifyPassword,
  dummyPasswordCompare,
  validatePasswordPolicy,
} from '../utils/password';
import { logger } from '../utils/logger';
import { canExposeDevelopmentCode, sendEmail } from './email.service';

/**
 * Authentication service — OWNER: IS (Adil)
 * References: FR1, FR2, FR3, SR2, SR3, FSR5, D1 section 9.1.
 * Matches the team schema: users (login) + patient/doctor (profile).
 */

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const GENERIC_LOGIN_ERROR = 'Invalid email or password.';
const RESET_TOKEN_MINUTES = 30;
const VERIFICATION_CODE_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
const GENERIC_RESET_MESSAGE = 'If an account exists for that email, a verification code has been sent.';
const REGISTRATION_CODE_MESSAGE = 'Verification code sent. Check your email before creating the account.';

export interface RegisterPatientInput {
  name: string;
  dateOfBirth: string; // 'YYYY-MM-DD'
  email: string;
  password: string;
  emailVerificationCode?: string;
}

interface RegistrationOptions {
  requireEmailVerification?: boolean;
}

export interface RegisterDoctorInput {
  name: string;
  email: string;
  password: string;
  emailVerificationCode?: string;
  specialty?: string; // Option A: team schema uses specialty, not licence number
}

export interface RegisterPharmacistInput {
  name: string;
  email: string;
  password: string;
  emailVerificationCode?: string;
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

interface PasswordResetTokenRow extends RowDataPacket {
  id: number;
  user_id: number;
  expires_at: Date;
  used_at: Date | null;
}

type VerificationPurpose = 'registration' | 'password_reset';

interface VerificationCodeRow extends RowDataPacket {
  id: number;
  email: string;
  purpose: VerificationPurpose;
  code_hash: string;
  expires_at: Date;
  attempts: number;
  used_at: Date | null;
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashVerificationCode(email: string, purpose: VerificationPurpose, code: string): string {
  return crypto
    .createHmac('sha256', config.session.secret)
    .update(`${normaliseEmail(email)}:${purpose}:${code}`)
    .digest('hex');
}

function generateVerificationCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

async function findUserIdByEmail(email: string): Promise<number | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [normaliseEmail(email)],
  );
  return rows[0]?.id ? Number(rows[0].id) : null;
}

async function consumeVerificationCode(
  rawEmail: string,
  purpose: VerificationPurpose,
  code: string,
): Promise<void> {
  const email = normaliseEmail(rawEmail);
  const [rows] = await pool.execute<VerificationCodeRow[]>(
    `SELECT id, email, purpose, code_hash, expires_at, attempts, used_at
     FROM email_verification_code
     WHERE email = ? AND purpose = ? AND used_at IS NULL
     ORDER BY id DESC
     LIMIT 1`,
    [email, purpose],
  );

  const record = rows[0];
  if (!record || record.expires_at.getTime() < Date.now() || record.attempts >= MAX_CODE_ATTEMPTS) {
    throw new AppError(400, 'Invalid or expired verification code.');
  }

  const expected = Buffer.from(record.code_hash, 'hex');
  const received = Buffer.from(hashVerificationCode(email, purpose, code), 'hex');
  const matches = expected.length === received.length && crypto.timingSafeEqual(expected, received);

  if (!matches) {
    await pool.execute(
      `UPDATE email_verification_code
       SET attempts = attempts + 1
       WHERE id = ?`,
      [record.id],
    );
    throw new AppError(400, 'Invalid or expired verification code.');
  }

  await pool.execute(
    `UPDATE email_verification_code
     SET used_at = NOW()
     WHERE id = ?`,
    [record.id],
  );
}

async function requireRegistrationVerification(email: string, code: string | undefined): Promise<void> {
  if (!code) {
    throw new AppError(400, 'Email verification code is required.');
  }
  await consumeVerificationCode(email, 'registration', code);
}

async function storeVerificationCode(
  email: string,
  purpose: VerificationPurpose,
  code: string,
  ip?: string,
): Promise<void> {
  await pool.execute(
    `UPDATE email_verification_code
     SET used_at = NOW()
     WHERE email = ? AND purpose = ? AND used_at IS NULL`,
    [email, purpose],
  );

  await pool.execute(
    `INSERT INTO email_verification_code
      (email, purpose, code_hash, expires_at, requested_ip)
     VALUES (?, ?, ?, ?, ?)`,
    [
      email,
      purpose,
      hashVerificationCode(email, purpose, code),
      toSqlDate(new Date(Date.now() + VERIFICATION_CODE_MINUTES * 60 * 1000)),
      ip ?? null,
    ],
  );
}

async function sendVerificationEmail(
  email: string,
  purpose: VerificationPurpose,
  code: string,
): Promise<boolean> {
  const isRegistration = purpose === 'registration';
  return sendEmail({
    to: email,
    subject: isRegistration ? 'Your HealthNexus verification code' : 'Your HealthNexus password reset code',
    text: [
      `Your HealthNexus ${isRegistration ? 'registration' : 'password reset'} code is: ${code}`,
      '',
      `This code expires in ${VERIFICATION_CODE_MINUTES} minutes.`,
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
  });
}

/** Register a patient (FR1): users row (active) + patient profile row. */
export async function registerPatient(
  input: RegisterPatientInput,
  options: RegistrationOptions = {},
): Promise<{ id: number }> {
  const email = normaliseEmail(input.email);
  if (options.requireEmailVerification !== false) {
    await requireRegistrationVerification(email, input.emailVerificationCode);
  }
  const passwordHash = await hashPassword(input.password);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [userResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, role, is_active, approval_status, email_verified)
       VALUES (?, ?, 'patient', TRUE, 'approved', TRUE)`,
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
  options: RegistrationOptions = {},
): Promise<{ id: number }> {
  const email = normaliseEmail(input.email);
  if (options.requireEmailVerification !== false) {
    await requireRegistrationVerification(email, input.emailVerificationCode);
  }
  const passwordHash = await hashPassword(input.password);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [userResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, role, is_active, approval_status, email_verified)
       VALUES (?, ?, 'doctor', FALSE, 'pending', TRUE)`,
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
  options: RegistrationOptions = {},
): Promise<{ id: number }> {
  const email = normaliseEmail(input.email);
  if (options.requireEmailVerification !== false) {
    await requireRegistrationVerification(email, input.emailVerificationCode);
  }
  const passwordHash = await hashPassword(input.password);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [userResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, role, is_active, approval_status, email_verified)
       VALUES (?, ?, 'pharmacist', FALSE, 'pending', TRUE)`,
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
  emailVerificationCode?: string;
}

export async function registerAdmin(
  input: RegisterAdminInput,
  options: RegistrationOptions = {},
): Promise<{ id: number }> {
  const email = normaliseEmail(input.email);
  if (options.requireEmailVerification !== false) {
    await requireRegistrationVerification(email, input.emailVerificationCode);
  }
  const passwordHash = await hashPassword(input.password);

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [userResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO users
       (email, password_hash, role, is_active, approval_status, email_verified)
       VALUES (?, ?, 'admin', TRUE, 'approved', TRUE)`,
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
	       AND u.deleted_at IS NULL
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

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function toSqlDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export interface PasswordResetRequestResult {
  message: string;
  developmentCode?: string;
}

export interface RegistrationCodeRequestResult {
  message: string;
  developmentCode?: string;
}

export interface PasswordResetCodeVerificationResult {
  resetToken: string;
}

export async function requestRegistrationVerificationCode(
  rawEmail: string,
  ip?: string,
): Promise<RegistrationCodeRequestResult> {
  const email = normaliseEmail(rawEmail);
  const existingUserId = await findUserIdByEmail(email);

  if (existingUserId) {
    throw new AppError(409, 'An account with this email already exists.');
  }

  const code = generateVerificationCode();
  await storeVerificationCode(email, 'registration', code, ip);
  const delivered = await sendVerificationEmail(email, 'registration', code);
  if (!delivered && !canExposeDevelopmentCode()) {
    throw new AppError(503, 'Unable to send verification code. Please try again later.');
  }

  return {
    message: REGISTRATION_CODE_MESSAGE,
    developmentCode: canExposeDevelopmentCode() ? code : undefined,
  };
}

export async function requestPasswordResetCode(
  rawEmail: string,
  ip?: string,
): Promise<PasswordResetRequestResult> {
  const email = normaliseEmail(rawEmail);
  const startedAt = Date.now();

  const userId = await findUserIdByEmail(email);
  let code: string | undefined;

  if (userId) {
    code = generateVerificationCode();
    await storeVerificationCode(email, 'password_reset', code, ip);
    const delivered = await sendVerificationEmail(email, 'password_reset', code);
    if (!delivered && !canExposeDevelopmentCode()) {
      throw new AppError(503, 'Unable to send verification code. Please try again later.');
    }
  } else {
    // Follow similar work for non-existent accounts to reduce enumeration clues.
    hashVerificationCode(email, 'password_reset', generateVerificationCode());
  }

  const elapsed = Date.now() - startedAt;
  if (elapsed < 350) {
    await new Promise((resolve) => setTimeout(resolve, 350 - elapsed));
  }

  return {
    message: GENERIC_RESET_MESSAGE,
    developmentCode: code && canExposeDevelopmentCode() ? code : undefined,
  };
}

export async function verifyPasswordResetCode(
  rawEmail: string,
  code: string,
  ip?: string,
): Promise<PasswordResetCodeVerificationResult> {
  const email = normaliseEmail(rawEmail);
  await consumeVerificationCode(email, 'password_reset', code);
  const userId = await findUserIdByEmail(email);

  if (!userId) {
    throw new AppError(400, 'Invalid or expired verification code.');
  }

  const resetToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashResetToken(resetToken);
  const expiresAt = toSqlDate(new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000));

  await pool.execute(
    `UPDATE password_reset_token
     SET used_at = NOW()
     WHERE user_id = ? AND used_at IS NULL`,
    [userId],
  );

  await pool.execute(
    `INSERT INTO password_reset_token
      (user_id, token_hash, expires_at, requested_ip)
     VALUES (?, ?, ?, ?)`,
    [userId, tokenHash, expiresAt, ip ?? null],
  );

  return { resetToken };
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<{ userId: number }> {
  const tokenHash = hashResetToken(token);
  const [rows] = await pool.execute<PasswordResetTokenRow[]>(
    `SELECT id, user_id, expires_at, used_at
     FROM password_reset_token
     WHERE token_hash = ?
     LIMIT 1`,
    [tokenHash],
  );

  const resetToken = rows[0];
  if (!resetToken || resetToken.used_at || resetToken.expires_at.getTime() < Date.now()) {
    throw new AppError(400, 'Invalid or expired reset link.');
  }

  const passwordErrors = validatePasswordPolicy(newPassword);
  if (passwordErrors.length > 0) {
    throw new AppError(400, passwordErrors.join(' '));
  }

  const passwordHash = await hashPassword(newPassword);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.execute(
      `UPDATE users
       SET password_hash = ?, failed_logins = 0, locked_until = NULL
       WHERE id = ?`,
      [passwordHash, resetToken.user_id],
    );

    await conn.execute(
      `UPDATE password_reset_token
       SET used_at = NOW()
       WHERE id = ? AND used_at IS NULL`,
      [resetToken.id],
    );

    // Invalidate existing server-side sessions for this account after credential change.
    await conn.execute(
      `DELETE FROM sessions
       WHERE user_id = ?`,
      [resetToken.user_id],
    );

    await conn.commit();
    return { userId: resetToken.user_id };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function attachSessionToUser(sessionId: string, userId: number): Promise<void> {
  await pool.execute(
    `UPDATE sessions
        SET user_id = ?
      WHERE session_id = ?`,
    [userId, sessionId],
  );
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
