/**
 * Per-request ownership / IDOR checks (D1 §9.2, FSR3/FSR4) — the #1 ranked risk.
 * Every resource ID (appointmentId, patientId, prescriptionId, documentId) is
 * checked against the server-side session user BEFORE the resource is returned
 * or mutated.
 *
 * Deny-by-default: an unknown role, a missing row, or a revoked relationship all
 * resolve to `false`, which the factory turns into a generic 404. Resolvers read
 * the shared clinical tables with parameterised statements only (never string
 * concatenation), matching the query style in auth.service.ts.
 */
import { Request, Response, NextFunction } from 'express';
import { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool';
import { recordAudit } from '../services/audit.service';

/** Resolver contract: may this session user access this resource id? */
export type OwnershipResolver = (
  userId: number,
  role: string,
  resourceId: number,
) => Promise<boolean>;

/**
 * Factory: pulls the resource id from req.params[paramName] and defers the
 * actual relationship check to `resolver`. Assumes requireAuth (and normally
 * requireActive/requireRole) have already run earlier in the chain.
 */
export function requireOwnership(paramName: string, resolver: OwnershipResolver) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.session.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const resourceId = Number(req.params[paramName]);
    if (!Number.isInteger(resourceId) || resourceId <= 0) {
      res.status(400).json({ error: 'Invalid resource identifier.' });
      return;
    }

    try {
      const allowed = await resolver(req.session.user.id, req.session.user.role, resourceId);
      if (!allowed) {
        // Log the failed access attempt (SR14/SR16) before responding. A generic
        // 404 (not 403) avoids confirming the resource exists — anti-IDOR.
        void recordAudit({
          userId: req.session.user.id,
          role: req.session.user.role,
          action: 'ownership.denied',
          target: `${paramName}=${resourceId} ${req.method} ${req.originalUrl}`,
          ip: req.ip,
          result: 'failure',
        });
        res.status(404).json({ error: 'Not found.' });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// ---------------------------------------------------------------------------
// Parameterised lookups
// ---------------------------------------------------------------------------

async function fetchOne<T extends RowDataPacket>(
  sql: string,
  params: Array<number | string>,
): Promise<T | undefined> {
  const [rows] = await pool.execute<T[]>(sql, params);
  return rows[0];
}

interface OwnerRow extends RowDataPacket {
  patient_id: number;
  doctor_id: number;
}

interface PatientRow extends RowDataPacket {
  patient_id: number;
}

// ---------------------------------------------------------------------------
// FSR4 — doctor ↔ patient treatment authorisation
// ---------------------------------------------------------------------------

/**
 * A doctor may access a patient's PHI only with an *active* treatment
 * relationship: an un-revoked `doctor_patient_auth` row, OR a non-cancelled
 * `appointment` between them (a booked / completed / rescheduled visit
 * establishes the clinical relationship). Cancelled appointments grant nothing.
 * Exported so it can be reused and unit-tested directly.
 */
export async function doctorHasTreatmentRelationship(
  doctorId: number,
  patientId: number,
): Promise<boolean> {
  const row = await fetchOne<RowDataPacket>(
    `SELECT 1 AS ok FROM doctor_patient_auth
       WHERE doctor_id = ? AND patient_id = ? AND revoked_at IS NULL
     UNION
     SELECT 1 AS ok FROM appointment
       WHERE doctor_id = ? AND patient_id = ?
         AND status IN ('booked','completed','rescheduled')
     LIMIT 1`,
    [doctorId, patientId, doctorId, patientId],
  );
  return row !== undefined;
}

// ---------------------------------------------------------------------------
// Resolvers (role-branching, deny-by-default). Wire these via requireOwnership,
// e.g. router.get('/appointments/:appointmentId', requireAuth, requireActive,
//                  requireOwnership('appointmentId', canAccessAppointment), handler)
// ---------------------------------------------------------------------------

/**
 * Patient-scoped records (medical history, diagnosis list, uploads) keyed by a
 * patientId in the URL. Patient → self only (SR8); doctor → treatment
 * relationship (FSR4); pharmacist/admin → no clinical access via this guard
 * (§9.8 — admins monitor through dedicated, audited admin endpoints instead).
 */
export const canAccessPatientRecord: OwnershipResolver = async (userId, role, patientId) => {
  switch (role) {
    case 'patient':
      return userId === patientId;
    case 'doctor':
      return doctorHasTreatmentRelationship(userId, patientId);
    default:
      return false;
  }
};

/** A single appointment keyed by appointmentId. */
export const canAccessAppointment: OwnershipResolver = async (userId, role, appointmentId) => {
  const appt = await fetchOne<OwnerRow>(
    'SELECT patient_id, doctor_id FROM appointment WHERE id = ? LIMIT 1',
    [appointmentId],
  );
  if (!appt) return false; // missing → deny (surfaced as 404)
  switch (role) {
    case 'patient':
      return userId === appt.patient_id;
    case 'doctor':
      return userId === appt.doctor_id;
    default:
      return false;
  }
};

/** A single prescription keyed by prescriptionId. */
export const canAccessPrescription: OwnershipResolver = async (userId, role, prescriptionId) => {
  const rx = await fetchOne<OwnerRow>(
    'SELECT patient_id, doctor_id FROM prescription WHERE id = ? LIMIT 1',
    [prescriptionId],
  );
  if (!rx) return false;
  switch (role) {
    case 'patient':
      return userId === rx.patient_id; // FR9/FR10: own prescriptions
    case 'doctor':
      // Issuing doctor, or one with a live treatment relationship (FSR4).
      if (userId === rx.doctor_id) return true;
      return doctorHasTreatmentRelationship(userId, rx.patient_id);
    case 'pharmacist':
      // FSR6: pharmacists may READ any prescription to fulfil it. The status-only
      // write restriction (FSR13) is enforced in the prescription service, not here.
      return true;
    default:
      return false;
  }
};

/** A single uploaded medical document keyed by documentId. */
export const canAccessDocument: OwnershipResolver = async (userId, role, documentId) => {
  const doc = await fetchOne<PatientRow>(
    'SELECT patient_id FROM medical_document WHERE id = ? LIMIT 1',
    [documentId],
  );
  if (!doc) return false;
  switch (role) {
    case 'patient':
      return userId === doc.patient_id;
    case 'doctor':
      return doctorHasTreatmentRelationship(userId, doc.patient_id); // FSR4
    default:
      return false; // pharmacist/admin: no document access (§9.8)
  }
};
