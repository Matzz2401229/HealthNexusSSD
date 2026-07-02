/**
 * Auth & session service (D1 §9.1). SKELETON for the Auth & session workstream.
 *
 * Security requirements to implement here:
 * - Register: enforce password policy, hash with bcrypt; doctors created
 *   inactive until admin approval; trigger OTP/email verification.
 * - Login: server-side validation; GENERIC error messages (no user
 *   enumeration); rate limit + lockout after 5 failed attempts; log attempts.
 * - Session: issue token ONLY after successful login; regenerate session id on
 *   login; Secure + HttpOnly + SameSite cookie; >=128 bits entropy; no
 *   sensitive data in the token; idle 15m / absolute 8h; invalidate on logout.
 */
import crypto from 'crypto';
import { validatePasswordPolicy, hashPassword, verifyPassword } from '../utils/password';
import { Role } from '../middleware/auth';

export interface RegisterInput {
  email: string;
  password: string;
  role: Role;
}

export interface LoginResult {
  ok: boolean;
  // On success the caller sets a Secure/HttpOnly/SameSite session cookie.
  sessionId?: string;
}

/** >=128 bits of entropy for session identifiers. */
export function newSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function register(input: RegisterInput): Promise<{ ok: boolean; error?: string }> {
  const policyError = validatePasswordPolicy(input.password);
  if (policyError) return { ok: false, error: policyError };

  const _passwordHash = await hashPassword(input.password);
  // TODO: INSERT user (parameterised); doctors -> is_active = FALSE (admin approval);
  // TODO: kick off OTP / email verification via the external service.
  return { ok: true };
}

export async function login(_email: string, _password: string): Promise<LoginResult> {
  // TODO: fetch user by email (parameterised); check lockout window.
  // TODO: verifyPassword(); on failure increment failed_logins, maybe lock.
  // TODO: enforce is_active + email_verified. Return the SAME generic error
  //       for "no such user", "wrong password", and "inactive" (no enumeration).
  // Placeholder wiring so the signature type-checks:
  void verifyPassword;
  return { ok: false };
}
