/**
 * Centralised, validated environment config (§7, D1 §9.6).
 * Secrets come ONLY from the environment — never hardcoded.
 * The app refuses to start if a required secret is missing.
 */
import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  return raw ? Number(raw) : fallback;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: num('BACKEND_PORT', 8080),

  db: {
    host: process.env.MYSQL_HOST ?? 'db',
    port: num('MYSQL_PORT', 3306),
    database: required('MYSQL_DATABASE'),
    user: required('MYSQL_USER'),
    password: required('MYSQL_PASSWORD'),
  },

  session: {
    secret: required('SESSION_SECRET'),
    idleTimeoutMin: num('SESSION_IDLE_TIMEOUT_MIN', 15),
    absoluteTimeoutHr: num('SESSION_ABSOLUTE_TIMEOUT_HR', 8),
  },

  bcryptRounds: num('BCRYPT_ROUNDS', 12),

  login: {
    maxAttempts: num('LOGIN_MAX_ATTEMPTS', 5),
    lockoutMinutes: num('LOGIN_LOCKOUT_MINUTES', 15),
  },

  upload: {
    maxBytes: num('UPLOAD_MAX_BYTES', 10 * 1024 * 1024),
    dir: process.env.UPLOAD_DIR ?? '/var/healthnexus/uploads',
  },

  isProd(): boolean {
    return this.nodeEnv === 'production';
  },
};

// Alias for compatibility
export const env = config;
