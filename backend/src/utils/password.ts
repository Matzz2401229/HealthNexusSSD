import bcryptjs from 'bcryptjs';

const BCRYPT_COST = 12;

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
  if (typeof password === 'string' && password.length > 128) {
    errors.push('Password must not exceed 128 characters.');
  }

  return errors;
}

export function hashPassword(plaintext: string): Promise<string> {
  return bcryptjs.hash(plaintext, BCRYPT_COST);
}

export function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(plaintext, hash);
}

const DUMMY_HASH = bcryptjs.hashSync(
  `dummy-${Date.now()}-${Math.random()}`,
  BCRYPT_COST,
);

export function dummyPasswordCompare(plaintext: string): Promise<boolean> {
  return bcryptjs.compare(plaintext, DUMMY_HASH);
}