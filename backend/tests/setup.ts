/**
 * Jest setup — provides the minimal env vars that config/env.ts validates at
 * import time, so unit tests run without a real .env. These are dummy values;
 * tests never touch a live DB or real secrets.
 */
process.env.MYSQL_DATABASE = process.env.MYSQL_DATABASE ?? 'test_db';
process.env.MYSQL_USER = process.env.MYSQL_USER ?? 'test_user';
process.env.MYSQL_PASSWORD = process.env.MYSQL_PASSWORD ?? 'test_password';
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'test_session_secret_at_least_32_chars_long';
