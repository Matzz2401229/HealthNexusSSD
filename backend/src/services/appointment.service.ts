import { query } from '../db/pool';

export interface Appointment {
    id: number;
    patient_id: number;
    doctor_id: number;
    scheduled_at: string;
    status: string;
    created_at: string;
}

export interface Diagnosis {
    id: number;
    appointment_id: number;
    doctor_id: number;
    remarks: string;
    created_at: string;
}

/** helper func to format JS Dates to MySQL DATETIME strings (UTC) */
function toMySqlDate(date: Date): string {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

// patient books appointment
export async function bookAppointment(patientId: number, doctorId: number, scheduledAt: Date): Promise<number> {
    const formattedDate = toMySqlDate(scheduledAt);

    const res = await query(
        `INSERT INTO appointment (patient_id, doctor_id, scheduled_at, status) 
         VALUES (?, ?, ?, 'booked')`,
        [patientId, doctorId, formattedDate] as any
    ) as any;

    const appointmentId = res.insertId;

    await query(
        `INSERT INTO doctor_patient_auth (doctor_id, patient_id) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE revoked_at = NULL`,
        [doctorId, patientId] as any
    );

    return appointmentId;
}

// patient can cancel appointment
export async function cancelAppointment(appointmentId: number, patientId: number): Promise<boolean> {
    const res = await query(
        `UPDATE appointment 
         SET status = 'cancelled' 
         WHERE id = ? AND patient_id = ? AND status != 'cancelled'`,
        [appointmentId, patientId] as any
    ) as any;

    if (res.affectedRows > 0) {
        const apptDetails = await query<{ doctor_id: number }>(
            `SELECT doctor_id FROM appointment WHERE id = ?`,
            [appointmentId] as any
        );

        if (apptDetails.length > 0) {
            const doctorId = apptDetails[0].doctor_id;

            const activeAppts = await query(
                `SELECT id FROM appointment 
                 WHERE patient_id = ? AND doctor_id = ? 
                 AND status IN ('booked', 'rescheduled')`,
                [patientId, doctorId] as any
            );

            if (activeAppts.length === 0) {
                await query(
                    `UPDATE doctor_patient_auth 
                     SET revoked_at = CURRENT_TIMESTAMP 
                     WHERE doctor_id = ? AND patient_id = ? AND revoked_at IS NULL`,
                    [doctorId, patientId] as any
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

    const res = await query(
        `UPDATE appointment 
         SET scheduled_at = ?, status = 'rescheduled' 
         WHERE id = ? AND patient_id = ? AND status IN ('booked', 'rescheduled')`,
        [formattedDate, appointmentId, patientId] as any
    ) as any;

    return res.affectedRows > 0;
}

// patient view appointment history
export async function getPatientAppointments(patientId: number): Promise<Appointment[]> {
    return query<Appointment>(
        `SELECT id, patient_id, doctor_id, scheduled_at, status, created_at 
         FROM appointment 
         WHERE patient_id = ? 
         ORDER BY scheduled_at DESC`,
        [patientId] as any
    );
}

// patient view diagnosis notes and remarks
export async function getPatientDiagnosis(appointmentId: number, patientId: number): Promise<Diagnosis[]> {
    return query<Diagnosis>(
        `SELECT d.id, d.appointment_id, d.doctor_id, d.remarks, d.created_at
         FROM diagnosis d
         JOIN appointment a ON d.appointment_id = a.id
         WHERE d.appointment_id = ? AND a.patient_id = ?`,
        [appointmentId, patientId] as any
    );
}

// doctor view appointment schedule
export async function getDoctorSchedule(doctorId: number): Promise<Appointment[]> {
    return query<Appointment>(
        `SELECT id, patient_id, doctor_id, scheduled_at, status, created_at 
         FROM appointment 
         WHERE doctor_id = ? 
         ORDER BY scheduled_at ASC`,
        [doctorId] as any
    );
}

// doctor update appointment status
export async function updateAppointmentStatus(appointmentId: number, doctorId: number, status: string): Promise<boolean> {
    const res = await query(
        `UPDATE appointment 
         SET status = ? 
         WHERE id = ? AND doctor_id = ?`,
        [status, appointmentId, doctorId] as any
    ) as any;

    return res.affectedRows > 0;
}

// doctor record diagnosis notes and remarks
export async function recordDiagnosis(appointmentId: number, doctorId: number, remarks: string): Promise<number | null> {
    const appts = await query<Appointment>(
        `SELECT id FROM appointment WHERE id = ? AND doctor_id = ?`,
        [appointmentId, doctorId] as any
    );

    if (appts.length === 0) return null;

    const res = await query(
        `INSERT INTO diagnosis (appointment_id, doctor_id, remarks) 
         VALUES (?, ?, ?)`,
        [appointmentId, doctorId, remarks] as any
    ) as any;

    return res.insertId;
}