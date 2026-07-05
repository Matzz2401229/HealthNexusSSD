import mysql from 'mysql2/promise';
import { env } from '../config/env';

export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: false,
});

export async function query<T = unknown>(
  sql: string,
  values?: Record<string, unknown>,
): Promise<T[]> {
  const conn = await pool.getConnection();
  try {
    // mysql2's execute() overloads don't model the named-placeholder object
    // form in their types, so cast the values through.
    const [rows] = await conn.execute(sql, values as never);
    return rows as T[];
  } finally {
    conn.release();
  }
}

export async function assertDbConnection(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}