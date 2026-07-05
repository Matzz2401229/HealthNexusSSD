/**
 * Prescriptions & pharmacist — service layer (workstream #6).
 *
 * The "brain" behind the prescription endpoints. Every function here enforces
 * the security rules from the design:
 *  - doctor_id/patient_id come from the caller's session, never client input (FSR2)
 *  - a doctor needs a treatment relationship before issuing (FSR4)
 *  - clinical fields are never written after issue (FSR13; DB trigger backs this)
 *  - pharmacists can only move fulfilment status, and only see prescription
 *    fields — never diagnosis/history (FSR6)
 *  - all DB access is parameterised with positional ? placeholders (FSR9)
 */
import { pool } from '../db/pool';
import { recordAudit } from './audit.service';
import type { Role } from '../middleware/auth';
import type { ResultSetHeader } from 'mysql2';

export type PrescriptionStatus = 'issued' | 'cancelled';
export type FulfilmentStatus = 'pending' | 'dispensed' | 'rejected';

export interface Prescription {
  id: number;
  patient_id: number;
  doctor_id: number;
  appointment_id: number | null;
  medication: string;
  dosage: string;
  instructions: string | null;
  status: PrescriptionStatus;
  fulfilment_status: FulfilmentStatus;
  fulfilled_by: number | null;
  fulfilled_at: string | null;
  issued_at: string;
}

export interface IssueInput {
  patientId: number;
  appointmentId?: number | null;
  medication: string;
  dosage: string;
  instructions?: string | null;
}

/** Thrown when a doctor has no appointment/treatment link to the patient (FSR4). */
export class NotAuthorisedError extends Error {}

// --- 1. Issue a prescription (doctor) -------------------------------------
export async function issuePrescription(doctorId: number, input: IssueInput): Promise<Prescription> {
  // FSR4: a doctor may only prescribe to a patient they actually treat.
  if (!(await hasTreatmentRelationship(doctorId, input.patientId))) {
    throw new NotAuthorisedError('No treatment relationship with this patient.');
  }

  // doctorId is the session user's id — NEVER taken from client input (FSR2).
  const result = await runWrite(
    `INSERT INTO prescription
       (patient_id, doctor_id, appointment_id, medication, dosage, instructions, status, fulfilment_status)
     VALUES (?, ?, ?, ?, ?, ?, 'issued', 'pending')`,
    [
      input.patientId,
      doctorId,
      input.appointmentId ?? null,
      input.medication,
      input.dosage,
      input.instructions ?? null,
    ],
  );

  await recordAudit({
    userId: doctorId,
    role: 'doctor',
    action: 'prescription.issue',
    target: `prescription:${result.insertId}`,
    result: 'success',
  });

  return (await getPrescriptionRaw(result.insertId)) as Prescription;
}

// --- 2. List a patient's own prescriptions --------------------------------
export async function listForPatient(patientId: number): Promise<Prescription[]> {
  // patientId is the session user's id, not a URL parameter → no IDOR (FSR3).
  return runQuery<Prescription>(
    `SELECT * FROM prescription WHERE patient_id = ? ORDER BY issued_at DESC`,
    [patientId],
  );
}

// --- 3. Get one prescription, with an ownership check ----------------------
export async function getForUser(
  prescriptionId: number,
  user: { id: number; role: Role },
): Promise<Prescription | null> {
  const row = await getPrescriptionRaw(prescriptionId);
  if (!row) return null;
  // Deny-by-default; the controller turns null into a 404 so IDs can't be probed.
  return canView(row, user) ? row : null;
}

// --- 4. Pharmacy queue (pharmacist) ---------------------------------------
export interface PharmacyQueueItem {
  id: number;
  patient_id: number;
  medication: string;
  dosage: string;
  instructions: string | null;
  status: PrescriptionStatus;
  fulfilment_status: FulfilmentStatus;
  issued_at: string;
}

export async function pharmacyQueue(): Promise<PharmacyQueueItem[]> {
  // FSR6: select ONLY the fields a pharmacist needs to dispense — no diagnosis,
  // no medical history. Never `SELECT *` here.
  return runQuery<PharmacyQueueItem>(
    `SELECT id, patient_id, medication, dosage, instructions, status, fulfilment_status, issued_at
       FROM prescription
      WHERE status = 'issued' AND fulfilment_status = 'pending'
      ORDER BY issued_at ASC`,
  );
}

// --- 5. Authorised patients for a doctor (backs the "issue" dropdown) ------
export interface AuthorisedPatient {
  id: number;
  full_name: string;
}

/**
 * List the patients a doctor is permitted to prescribe to (FSR4): those with an
 * active treatment relationship OR any appointment. Returns only id + name — the
 * minimum needed to populate the issue-prescription patient selector, never any
 * medical history or diagnosis (least privilege). doctorId comes from the
 * session, never from client input (FSR2).
 */
export async function listAuthorisedPatients(doctorId: number): Promise<AuthorisedPatient[]> {
  return runQuery<AuthorisedPatient>(
    `SELECT p.id, p.full_name
       FROM patient p
      WHERE p.id IN (
              SELECT patient_id FROM doctor_patient_auth
                WHERE doctor_id = ? AND revoked_at IS NULL
              UNION
              SELECT patient_id FROM appointment
                WHERE doctor_id = ?
            )
      ORDER BY p.full_name ASC`,
    [doctorId, doctorId],
  );
}

// --- 6. A doctor's own issued prescriptions (view + track fulfilment) -----
export interface DoctorPrescriptionItem {
  id: number;
  patient_id: number;
  patient_name: string;
  medication: string;
  dosage: string;
  instructions: string | null;
  status: PrescriptionStatus;
  fulfilment_status: FulfilmentStatus;
  issued_at: string;
  fulfilled_at: string | null;
}

/**
 * List the prescriptions a doctor has issued, with the patient's name and the
 * current fulfilment status (Data Control Matrix §9.8: a doctor may "view
 * fulfilment status"). doctorId comes from the session, never client input
 * (FSR2); the WHERE clause scopes strictly to the doctor's own records (FSR3).
 */
export async function listForDoctor(doctorId: number): Promise<DoctorPrescriptionItem[]> {
  return runQuery<DoctorPrescriptionItem>(
    `SELECT p.id, p.patient_id, pt.full_name AS patient_name,
            p.medication, p.dosage, p.instructions,
            p.status, p.fulfilment_status, p.issued_at, p.fulfilled_at
       FROM prescription p
       JOIN patient pt ON pt.id = p.patient_id
      WHERE p.doctor_id = ?
      ORDER BY p.issued_at DESC`,
    [doctorId],
  );
}

// --- 7. Update fulfilment status (pharmacist, status-only) ----------------
export async function updateFulfilment(
  prescriptionId: number,
  pharmacistId: number,
  newStatus: FulfilmentStatus,
): Promise<boolean> {
  // FSR6: a pharmacist may only move a *pending* prescription to dispensed/rejected.
  if (newStatus !== 'dispensed' && newStatus !== 'rejected') {
    throw new Error('Invalid fulfilment status.');
  }

  // Writes ONLY the fulfilment fields — medication/dosage/etc. are never in this
  // statement (FSR13; the DB trigger also blocks it). The WHERE clause prevents
  // re-actioning an already-handled prescription.
  const result = await runWrite(
    `UPDATE prescription
        SET fulfilment_status = ?, fulfilled_by = ?, fulfilled_at = NOW()
      WHERE id = ? AND status = 'issued' AND fulfilment_status = 'pending'`,
    [newStatus, pharmacistId, prescriptionId],
  );

  const updated = result.affectedRows === 1;
  await recordAudit({
    userId: pharmacistId,
    role: 'pharmacist',
    action: 'prescription.fulfil',
    target: `prescription:${prescriptionId}`,
    result: updated ? 'success' : 'failure',
  });
  return updated;
}

// --- 8. Cancel a prescription (doctor, own + still-pending only) -----------
export async function cancelPrescription(
  prescriptionId: number,
  doctorId: number,
): Promise<boolean> {
  // Only the issuing doctor may cancel, and only while the prescription is
  // still issued + pending — you cannot cancel one a pharmacist has already
  // dispensed or rejected. The doctor_id in the WHERE clause enforces ownership
  // (IDOR-safe, FSR3). Changing `status` is permitted by the immutability
  // trigger; the clinical fields stay locked (FSR13).
  const result = await runWrite(
    `UPDATE prescription
        SET status = 'cancelled'
      WHERE id = ? AND doctor_id = ? AND status = 'issued' AND fulfilment_status = 'pending'`,
    [prescriptionId, doctorId],
  );

  const cancelled = result.affectedRows === 1;
  await recordAudit({
    userId: doctorId,
    role: 'doctor',
    action: 'prescription.cancel',
    target: `prescription:${prescriptionId}`,
    result: cancelled ? 'success' : 'failure',
  });
  return cancelled;
}

// --- helpers --------------------------------------------------------------

/** Run a SELECT and return the rows. */
async function runQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.execute(sql, params as never);
  return rows as T[];
}

/** Run an INSERT/UPDATE and return the raw result (insertId, affectedRows). */
async function runWrite(sql: string, params: unknown[]): Promise<ResultSetHeader> {
  const [result] = await pool.execute(sql, params as never);
  return result as ResultSetHeader;
}

async function getPrescriptionRaw(id: number): Promise<Prescription | null> {
  const rows = await runQuery<Prescription>(`SELECT * FROM prescription WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

/** FSR4: true if the doctor has an active treatment link or appointment. */
async function hasTreatmentRelationship(doctorId: number, patientId: number): Promise<boolean> {
  const rows = await runQuery(
    `SELECT 1 FROM doctor_patient_auth
       WHERE doctor_id = ? AND patient_id = ? AND revoked_at IS NULL
     UNION
     SELECT 1 FROM appointment
       WHERE doctor_id = ? AND patient_id = ?
     LIMIT 1`,
    [doctorId, patientId, doctorId, patientId],
  );
  return rows.length > 0;
}

/** Role-based visibility for a single prescription (FSR3 ownership). */
function canView(row: Prescription, user: { id: number; role: Role }): boolean {
  switch (user.role) {
    case 'patient':
      return row.patient_id === user.id;
    case 'doctor':
      return row.doctor_id === user.id;
    case 'pharmacist':
      return true; // may view in order to fulfil
    case 'admin':
      return true; // monitor (read-only)
    default:
      return false;
  }
}
