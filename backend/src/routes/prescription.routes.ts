/**
 * Prescription routes (workstream #6). Every route requires a logged-in user
 * (requireAuth); role-restricted routes add requireRole. State-changing routes
 * are already CSRF-protected by the global middleware in index.ts (FSR12).
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validation';
import * as controller from '../controllers/prescription.controller';

const router = Router();

const issueSchema = z.object({
  patientId: z.number().int().positive(),
  appointmentId: z.number().int().positive().optional(),
  medication: z.string().min(1).max(255),
  dosage: z.string().min(1).max(255),
  instructions: z.string().max(2000).optional(),
});

const fulfilmentSchema = z.object({
  fulfilmentStatus: z.enum(['dispensed', 'rejected']),
});

// All prescription endpoints require authentication.
router.use(requireAuth);

// IMPORTANT: fixed paths (/mine, /pharmacy) must be declared BEFORE the
// dynamic /:id route, or Express would treat "mine"/"pharmacy" as an :id.
router.get('/mine', requireRole('patient'), controller.listMine);
router.get('/pharmacy', requireRole('pharmacist'), controller.pharmacyQueue);
router.get('/patients', requireRole('doctor'), controller.myPatients);
router.get('/issued', requireRole('doctor'), controller.listIssued);

router.post('/', requireRole('doctor'), validate(issueSchema), controller.issue);

router.get('/:id', controller.getOne);
router.get('/:id/download', controller.download);
router.patch('/:id/cancel', requireRole('doctor'), controller.cancel);
router.patch('/:id/fulfilment', requireRole('pharmacist'), validate(fulfilmentSchema), controller.updateFulfilment);

export default router;
