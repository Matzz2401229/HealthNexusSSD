import { query } from '../db/pool';
import { ResultSetHeader } from 'mysql2';

export interface Appointment {
    id: number;
    patient_id: number;
    doctor_id: number;
    scheduled_at: string;
    status: string;
    created_at: string;
    patient_name?: string; // joined for the doctor's schedule view
}

export interface Diagnosis {
    id: number;
    appointment_id: number;
    doctor_id: number;
    remarks: string;
    created_at: string;
}

export interface AvailableDoctor {
    id: number;
    full_name: string;
    specialty: string;
}

/** helper func to format JS Dates to MySQL DATETIME strings (UTC) */
function toMySqlDate(date: Date): string {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

// patient books appointment
export async function bookAppointment(patientId: number, doctorId: number, scheduledAt: Date): Promise<number> {
    const formattedDate = toMySqlDate(scheduledAt);

    const res = (await query(
        `INSERT INTO appointment (patient_id, doctor_id, scheduled_at, status) 
         VALUES (?, ?, ?, 'booked')`,
        [patientId, doctorId, formattedDate] as unknown as Record<string, unknown>
    )) as unknown as ResultSetHeader;

    const appointmentId = res.insertId;

    await query(
        `INSERT INTO doctor_patient_auth (doctor_id, patient_id) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE revoked_at = NULL`,
        [doctorId, patientId] as unknown as Record<string, unknown>
    );

    return appointmentId;
}

// patient can cancel appointment
export async function cancelAppointment(appointmentId: number, patientId: number): Promise<boolean> {
    const res = (await query(
        `UPDATE appointment 
         SET status = 'cancelled' 
         WHERE id = ? AND patient_id = ? AND status != 'cancelled'`,
        [appointmentId, patientId] as unknown as Record<string, unknown>
    )) as unknown as ResultSetHeader;

    if (res.affectedRows > 0) {
        const apptDetails = await query<{ doctor_id: number }>(
            `SELECT doctor_id FROM appointment WHERE id = ?`,
            [appointmentId] as unknown as Record<string, unknown>
        );

        if (apptDetails.length > 0) {
            const doctorId = apptDetails[0].doctor_id;

            const activeAppts = await query(
                `SELECT id FROM appointment 
                 WHERE patient_id = ? AND doctor_id = ? 
                 AND status IN ('booked', 'rescheduled')`,
                [patientId, doctorId] as unknown as Record<string, unknown>
            );

            if (activeAppts.length === 0) {
                await query(
                    `UPDATE doctor_patient_auth 
                     SET revoked_at = CURRENT_TIMESTAMP 
                     WHERE doctor_id = ? AND patient_id = ? AND revoked_at IS NULL`,
                    [doctorId, patientId] as unknown as Record<string, unknown>
                );
            }
        }
        return true;
    }

    return false;
}

// patient can reschedule appointment
export async function rescheduleAppointment(appointmentId: number, patientId: number, newScheduledAt: Date): Promise<boolean> {
    const formattedDate = toMySqlDate(newScheduledAt);

    const res = (await query(
        `UPDATE appointment 
         SET scheduled_at = ?, status = 'rescheduled' 
         WHERE id = ? AND patient_id = ? AND status IN ('booked', 'rescheduled')`,
        [formattedDate, appointmentId, patientId] as unknown as Record<string, unknown>
    )) as unknown as ResultSetHeader;

    return res.affectedRows > 0;
}

// patient view appointment history
export async function getPatientAppointments(patientId: number): Promise<Appointment[]> {
    return query<Appointment>(
        `SELECT id, patient_id, doctor_id, scheduled_at, status, created_at 
         FROM appointment 
         WHERE patient_id = ? 
         ORDER BY scheduled_at DESC`,
        [patientId] as unknown as Record<string, unknown>
    );
}

// patient view diagnosis notes and remarks
export async function getPatientDiagnosis(appointmentId: number, patientId: number): Promise<Diagnosis[]> {
    return query<Diagnosis>(
        `SELECT d.id, d.appointment_id, d.doctor_id, d.remarks, d.created_at
         FROM diagnosis d
         JOIN appointment a ON d.appointment_id = a.id
         WHERE d.appointment_id = ? AND a.patient_id = ?`,
        [appointmentId, patientId] as unknown as Record<string, unknown>
    );
}

// doctor view appointment schedule
export async function getDoctorSchedule(doctorId: number): Promise<Appointment[]> {
    return query<Appointment>(
        `SELECT a.id, a.patient_id, a.doctor_id, a.scheduled_at, a.status, a.created_at,
                p.full_name AS patient_name
         FROM appointment a
         JOIN patient p ON p.id = a.patient_id
         WHERE a.doctor_id = ?
         ORDER BY a.scheduled_at ASC`,
        [doctorId] as unknown as Record<string, unknown>
    );
}

// doctor update appointment status
export async function updateAppointmentStatus(appointmentId: number, doctorId: number, status: string): Promise<boolean> {
    const res = (await query(
        `UPDATE appointment 
         SET status = ? 
         WHERE id = ? AND doctor_id = ?`,
        [status, appointmentId, doctorId] as unknown as Record<string, unknown>
    )) as unknown as ResultSetHeader;

    return res.affectedRows > 0;
}

// FR18: Doctor record diagnosis notes and remarks
export async function recordDiagnosis(appointmentId: number, doctorId: number, remarks: string): Promise<number | null> {
    const appts = await query<Appointment>(
        `SELECT id FROM appointment WHERE id = ? AND doctor_id = ?`,
        [appointmentId, doctorId] as unknown as Record<string, unknown>
    );

    if (appts.length === 0) return null;

    const res = (await query(
        `INSERT INTO diagnosis (appointment_id, doctor_id, remarks) 
         VALUES (?, ?, ?)`,
        [appointmentId, doctorId, remarks] as unknown as Record<string, unknown>
    )) as unknown as ResultSetHeader;

    return res.insertId;
}

// Fetch available doctors for the booking dropdown
export async function getAvailableDoctors(): Promise<AvailableDoctor[]> {
    return query<AvailableDoctor>(
        `SELECT d.id, d.full_name, d.specialty 
         FROM doctor d
         JOIN users u ON d.id = u.id
         WHERE u.is_active = 1`
    );
}