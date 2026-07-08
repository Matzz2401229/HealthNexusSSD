import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from '../db/pool';

interface DeletedUserRow extends RowDataPacket {
  id: number;
  email: string;
}

async function deleteLoadedUser(conn: PoolConnection, id: number, email: string): Promise<void> {
  await conn.execute('DELETE FROM sessions WHERE user_id = ?', [id]);
  await conn.execute('DELETE FROM email_verification_code WHERE email = ?', [email]);
  await conn.execute('UPDATE doctor SET approved_by = NULL WHERE approved_by = ?', [id]);
  await conn.execute('UPDATE announcement SET deleted_at = NOW() WHERE author_id = ? AND deleted_at IS NULL', [id]);
  await conn.execute('DELETE FROM document_request WHERE requester_id = ? OR reviewed_by = ?', [id, id]);
  await conn.execute(
    `DELETE dr
       FROM document_request dr
       JOIN medical_document md ON md.id = dr.document_id
      WHERE md.patient_id = ? OR md.uploaded_by = ?`,
    [id, id],
  );
  await conn.execute('DELETE FROM medical_document WHERE patient_id = ? OR uploaded_by = ?', [id, id]);
  await conn.execute(
    `DELETE d
       FROM diagnosis d
       JOIN appointment a ON a.id = d.appointment_id
      WHERE a.patient_id = ? OR a.doctor_id = ?`,
    [id, id],
  );
  await conn.execute('DELETE FROM prescription WHERE patient_id = ? OR doctor_id = ? OR fulfilled_by = ?', [id, id, id]);
  await conn.execute('DELETE FROM diagnosis WHERE doctor_id = ?', [id]);
  await conn.execute('DELETE FROM appointment WHERE patient_id = ? OR doctor_id = ?', [id, id]);
  await conn.execute('DELETE FROM doctor_patient_auth WHERE patient_id = ? OR doctor_id = ?', [id, id]);
  await conn.execute('DELETE FROM users WHERE id = ?', [id]);
}

export async function hardDeleteUserById(id: number): Promise<boolean> {
  let conn: PoolConnection | null = null;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [users] = await conn.execute<DeletedUserRow[]>(
      'SELECT id, email FROM users WHERE id = ? LIMIT 1',
      [id],
    );
    const user = users[0];
    if (!user) {
      await conn.rollback();
      return false;
    }

    await deleteLoadedUser(conn, user.id, user.email);
    await conn.commit();
    return true;
  } catch (err) {
    if (conn) {
      await conn.rollback();
    }
    throw err;
  } finally {
    conn?.release();
  }
}

export async function purgeSoftDeletedUserByEmail(email: string): Promise<void> {
  let conn: PoolConnection | null = null;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [users] = await conn.execute<DeletedUserRow[]>(
      'SELECT id, email FROM users WHERE email = ? AND deleted_at IS NOT NULL LIMIT 1',
      [email],
    );
    const user = users[0];
    if (user) {
      await deleteLoadedUser(conn, user.id, user.email);
    }

    await conn.commit();
  } catch (err) {
    if (conn) {
      await conn.rollback();
    }
    throw err;
  } finally {
    conn?.release();
  }
}
