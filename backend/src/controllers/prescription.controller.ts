/**
 * Prescriptions & pharmacist — HTTP layer (workstream #6).
 * Thin controllers: translate the request into a service call and the result
 * into an HTTP status. All handlers run behind requireAuth, so req.session.user is set.
 */
import { Request, Response, NextFunction } from 'express';
import 'express-session';
import * as prescriptions from '../services/prescription.service';
import { NotAuthorisedError, Prescription } from '../services/prescription.service';
import { recordAudit } from '../services/audit.service';

/** Parse a positive integer route param, or null if invalid. */
function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// POST /prescriptions  (doctor issues)
export async function issue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const created = await prescriptions.issuePrescription(req.session.user!.id, req.body);
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof NotAuthorisedError) {
      res.status(403).json({ error: 'You are not authorised to prescribe to this patient.' });
      return;
    }
    next(err);
  }
}

// GET /prescriptions/mine  (patient's own list)
export async function listMine(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await prescriptions.listForPatient(req.session.user!.id));
  } catch (err) {
    next(err);
  }
}

// GET /prescriptions/pharmacy  (pharmacist queue)
export async function pharmacyQueue(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await prescriptions.pharmacyQueue());
  } catch (err) {
    next(err);
  }
}

// GET /prescriptions/:id  (view one, ownership-checked)
export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid prescription id.' });
      return;
    }
    const row = await prescriptions.getForUser(id, req.session.user!);
    if (!row) {
      res.status(404).json({ error: 'Not found.' });
      return;
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
}

// GET /prescriptions/:id/download  (download own prescription — logged, SR17)
export async function download(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid prescription id.' });
      return;
    }
    const row = await prescriptions.getForUser(id, req.session.user!);
    if (!row) {
      res.status(404).json({ error: 'Not found.' });
      return;
    }
    await recordAudit({
      userId: req.session.user!.id,
      role: req.session.user!.role,
      action: 'prescription.download',
      target: `prescription:${id}`,
      result: 'success',
    });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="prescription-${id}.txt"`);
    res.send(renderPrescriptionText(row));
  } catch (err) {
    next(err);
  }
}

// PATCH /prescriptions/:id/fulfilment  (pharmacist updates status only)
export async function updateFulfilment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid prescription id.' });
      return;
    }
    const ok = await prescriptions.updateFulfilment(id, req.session.user!.id, req.body.fulfilmentStatus);
    if (!ok) {
      res.status(404).json({ error: 'Prescription not found or already actioned.' });
      return;
    }
    res.json({ message: 'Fulfilment updated.' });
  } catch (err) {
    next(err);
  }
}

/** Plain-text prescription document. (PDF rendering can replace this later.) */
function renderPrescriptionText(p: Prescription): string {
  return [
    'HealthNexus Prescription',
    `ID: ${p.id}`,
    `Medication: ${p.medication}`,
    `Dosage: ${p.dosage}`,
    p.instructions ? `Instructions: ${p.instructions}` : null,
    `Status: ${p.status}`,
    `Issued: ${p.issued_at}`,
  ]
    .filter(Boolean)
    .join('\n');
}
