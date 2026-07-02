/**
 * Password policy + hashing (D1 §9.1).
 * - min 12 chars, upper/lower/digit/special
 * - bcrypt with per-password unique salt (bcrypt generates the salt)
 * - never store or log plaintext
 */
import bcrypt from 'bcryptjs';
import { config } from '../config/env';

const MIN_LENGTH = 12;

/** Returns null if valid, or a human-readable reason if not. */
export function validatePasswordPolicy(password: string): string | null {
  if (password.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters.`;
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain a digit.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain a special character.';
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  // bcrypt.hash generates a unique salt per call and embeds it in the output.
  return bcrypt.hash(password, config.bcryptRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
