/**
 * MySQL connection pool. ALL queries go through parameterised statements —
 * string concatenation into SQL is prohibited (D1 §9.5). Use `pool.execute`
 * with placeholders, never template literals with user input.
 */
import mysql from 'mysql2/promise';
import { config } from '../config/env';

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

/** Thin helper to make parameterised queries the path of least resistance. */
export async function query<T = unknown>(
  sql: string,
  params?: Record<string, unknown> | unknown[],
): Promise<T[]> {
  // namedPlaceholders lets us pass an object; mysql2's execute() overloads
  // don't model that in their types, so cast the params through.
  const [rows] = await pool.execute(sql, params as never);
  return rows as T[];
}
