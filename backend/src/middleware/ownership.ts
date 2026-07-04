/**
 * Per-request ownership / IDOR checks (D1 §9.2, FSR4) — the #1 ranked risk.
 * Every resource ID (appointmentId, patientId, prescriptionId, recordId,
 * documentId) must be checked against the session user BEFORE the resource
 * is returned or mutated. Deny-by-default.
 *
 * SKELETON: the resolver functions must query the DB with parameterised
 * statements to confirm the relationship. Doctors additionally need a valid
 * appointment / doctor_patient_auth relationship before accessing a record.
 */
import { Request, Response, NextFunction } from 'express';

type OwnershipResolver = (userId: number, role: string, resourceId: number) => Promise<boolean>;

/**
 * Factory: pulls the resource id from req.params[paramName] and defers the
 * actual relationship check to `resolver`.
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
        // Generic 404 (not 403) avoids confirming the resource exists (anti-IDOR).
        res.status(404).json({ error: 'Not found.' });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Example resolver stub — a doctor may access a patient record only via a live
 * appointment or an active doctor_patient_auth row. Implement with a
 * parameterised query in the RBAC & IDOR workstream.
 */
export const doctorTreatsPatient: OwnershipResolver = async (_doctorId, _role, _patientId) => {
  // TODO: SELECT 1 FROM doctor_patient_auth WHERE doctor_id = :d AND patient_id = :p AND revoked_at IS NULL
  return false; // deny-by-default until implemented
};
