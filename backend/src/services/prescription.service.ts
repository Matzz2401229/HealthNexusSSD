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
 *  - all DB access is parameterised (FSR9)
 */
import { pool, query } from '../db/pool';
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
     VALUES (:patientId, :doctorId, :appointmentId, :medication, :dosage, :instructions, 'issued', 'pending')`,
    {
      patientId: input.patientId,
      doctorId,
      appointmentId: input.appointmentId ?? null,
      medication: input.medication,
      dosage: input.dosage,
      instructions: input.instructions ?? null,
    },
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
  return query<Prescription>(
    `SELECT * FROM prescription WHERE patient_id = :patientId ORDER BY issued_at DESC`,
    { patientId },
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
  return query<PharmacyQueueItem>(
    `SELECT id, patient_id, medication, dosage, instructions, status, fulfilment_status, issued_at
       FROM prescription
      WHERE status = 'issued' AND fulfilment_status = 'pending'
      ORDER BY issued_at ASC`,
  );
}

// --- 5. Update fulfilment status (pharmacist, status-only) ----------------
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
        SET fulfilment_status = :newStatus, fulfilled_by = :pharmacistId, fulfilled_at = NOW()
      WHERE id = :prescriptionId AND status = 'issued' AND fulfilment_status = 'pending'`,
    { newStatus, pharmacistId, prescriptionId },
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

// --- helpers --------------------------------------------------------------

/** Run an INSERT/UPDATE and return the raw result (insertId, affectedRows). */
async function runWrite(sql: string, params: Record<string, unknown>): Promise<ResultSetHeader> {
  const [result] = await pool.execute(sql, params as never);
  return result as ResultSetHeader;
}

async function getPrescriptionRaw(id: number): Promise<Prescription | null> {
  const rows = await query<Prescription>(`SELECT * FROM prescription WHERE id = :id`, { id });
  return rows[0] ?? null;
}

/** FSR4: true if the doctor has an active treatment link or appointment. */
async function hasTreatmentRelationship(doctorId: number, patientId: number): Promise<boolean> {
  const rows = await query(
    `SELECT 1 FROM doctor_patient_auth
       WHERE doctor_id = :doctorId AND patient_id = :patientId AND revoked_at IS NULL
     UNION
     SELECT 1 FROM appointment
       WHERE doctor_id = :doctorId AND patient_id = :patientId
     LIMIT 1`,
    { doctorId, patientId },
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
