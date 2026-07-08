import bcrypt from 'bcryptjs';

/**
 * Password utilities — OWNER: IS (Adil)
 * References: FSR7 (password policy), D1 9.1 / 9.3 (bcrypt + unique salt).
 *
 * bcrypt generates and embeds a unique random salt in every hash, so we do
 * NOT manage salts by hand — that satisfies "stored using bcrypt with a
 * unique salt" in the report. Cost factor 12 is a sensible 2025 default.
 */
const BCRYPT_COST = 12;

/**
 * FSR7 policy: minimum 12 characters, and at least one uppercase, one
 * lowercase, one digit, and one special character.
 * Returns a list of human-readable problems ([] means the password passes).
 */
export function validatePasswordPolicy(password: string): string[] {
  const errors: string[] = [];

  if (typeof password !== 'string' || password.length < 12) {
    errors.push('Password must be at least 12 characters long.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter.');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter.');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit.');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character.');
  }
  // Upper bound guards against bcrypt's 72-byte truncation and DoS via huge
  // inputs; 128 is comfortably above the 12-char minimum.
  if (typeof password === 'string' && password.length > 128) {
    errors.push('Password must not exceed 128 characters.');
  }

  return errors;
}

/** Hash a plaintext password. bcrypt embeds a fresh random salt. */
export function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

/** Verify a plaintext password against a stored bcrypt hash. */
export function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/**
 * A valid bcrypt hash of a random throwaway value, generated once at startup.
 *
 * When a login is attempted for an email that does not exist, we still run a
 * bcrypt comparison against THIS hash before returning the generic error.
 * That keeps the response time for "no such user" close to "wrong password",
 * removing the timing side-channel that enables user enumeration
 * (D1 attack surface: /login user enumeration). Using the same cost factor is
 * what makes the timings comparable.
 */
const DUMMY_HASH = bcrypt.hashSync(
  `dummy-${Date.now()}-${Math.random()}`,
  BCRYPT_COST,
);

export function dummyPasswordCompare(plaintext: string): Promise<boolean> {
  return bcrypt.compare(plaintext, DUMMY_HASH);
}
