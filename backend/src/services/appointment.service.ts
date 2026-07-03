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

    // use parameterized query to prevent SQL injection
    const res = await query(
        `INSERT INTO appointment (patient_id, doctor_id, scheduled_at, status) 
         VALUES (:patientId, :doctorId, :scheduledAt, 'booked')`,
        { patientId, doctorId, scheduledAt: formattedDate }
    ) as any;

    const appointmentId = res.insertId;

    await query(
        `INSERT INTO doctor_patient_auth (doctor_id, patient_id) 
         VALUES (:doctorId, :patientId) 
         ON DUPLICATE KEY UPDATE revoked_at = NULL`,
        { doctorId, patientId }
    );

    return appointmentId;
}

// patient can cancel appointment
export async function cancelAppointment(appointmentId: number, patientId: number): Promise<boolean> {
    // appointment must belong to the patient
    const res = await query(
        `UPDATE appointment 
         SET status = 'cancelled' 
         WHERE id = :appointmentId AND patient_id = :patientId AND status != 'cancelled'`,
        { appointmentId, patientId }
    ) as any;

    // revoke doctors access to patients record if cancelled appt
    if (res.affectedRows > 0) {
        const apptDetails = await query<{ doctor_id: number }>(
            `SELECT doctor_id FROM appointment WHERE id = :appointmentId`,
            { appointmentId }
        );

        if (apptDetails.length > 0) {
            const doctorId = apptDetails[0].doctor_id;

            // look for any remaining active appointments between this doctor and patient
            const activeAppts = await query(
                `SELECT id FROM appointment 
                 WHERE patient_id = :patientId AND doctor_id = :doctorId 
                 AND status IN ('booked', 'rescheduled')`,
                { patientId, doctorId }
            );

            // if no other active relationships are open, revoke the master access row
            if (activeAppts.length === 0) {
                await query(
                    `UPDATE doctor_patient_auth 
                     SET revoked_at = CURRENT_TIMESTAMP 
                     WHERE doctor_id = :doctorId AND patient_id = :patientId AND revoked_at IS NULL`,
                    { doctorId, patientId }
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

    // appointment must belong to the patient
    const res = await query(
        `UPDATE appointment 
         SET scheduled_at = :newScheduledAt, status = 'rescheduled' 
         WHERE id = :appointmentId AND patient_id = :patientId AND status IN ('booked', 'rescheduled')`,
        { appointmentId, patientId, newScheduledAt: formattedDate }
    ) as any;

    return res.affectedRows > 0;
}

// patient view appointment history
export async function getPatientAppointments(patientId: number): Promise<Appointment[]> {
    return query<Appointment>(
        `SELECT id, patient_id, doctor_id, scheduled_at, status, created_at 
         FROM appointment 
         WHERE patient_id = :patientId 
         ORDER BY scheduled_at DESC`,
        { patientId }
    );
}

// patient view diagnosis notes and remarks
export async function getPatientDiagnosis(appointmentId: number, patientId: number): Promise<Diagnosis[]> {
    // verify ownership with patient_id
    return query<Diagnosis>(
        `SELECT d.id, d.appointment_id, d.doctor_id, d.remarks, d.created_at
         FROM diagnosis d
         JOIN appointment a ON d.appointment_id = a.id
         WHERE d.appointment_id = :appointmentId AND a.patient_id = :patientId`,
        { appointmentId, patientId }
    );
}

// doctor view appointment schedule
export async function getDoctorSchedule(doctorId: number): Promise<Appointment[]> {
    return query<Appointment>(
        `SELECT id, patient_id, doctor_id, scheduled_at, status, created_at 
         FROM appointment 
         WHERE doctor_id = :doctorId 
         ORDER BY scheduled_at ASC`,
        { doctorId }
    );
}

// doctor update appointment status
export async function updateAppointmentStatus(appointmentId: number, doctorId: number, status: string): Promise<boolean> {
    // doctor can only update their own appointments
    const res = await query(
        `UPDATE appointment 
         SET status = :status 
         WHERE id = :appointmentId AND doctor_id = :doctorId`,
        { appointmentId, doctorId, status }
    ) as any;

    return res.affectedRows > 0;
}

// FR18: Doctor record diagnosis notes and remarks
export async function recordDiagnosis(appointmentId: number, doctorId: number, remarks: string): Promise<number | null> {
    // FSR4: Check if the appointment belongs to the doctor before writing data
    const appts = await query<Appointment>(
        `SELECT id FROM appointment WHERE id = :appointmentId AND doctor_id = :doctorId`,
        { appointmentId, doctorId }
    );

    if (appts.length === 0) return null; // Unauthorized or not found

    const res = await query(
        `INSERT INTO diagnosis (appointment_id, doctor_id, remarks) 
         VALUES (:appointmentId, :doctorId, :remarks)`,
        { appointmentId, doctorId, remarks }
    ) as any;

    return res.insertId;
}