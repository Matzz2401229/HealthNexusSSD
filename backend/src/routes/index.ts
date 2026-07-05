/**
 * Route aggregator. Mount feature routers here as each workstream lands
 * (appointments, prescriptions, documents, admin, ...), all behind
 * requireAuth + requireRole + ownership checks.
 */
import { Router } from 'express';
import authRoutes from './auth.routes';
import prescriptionRoutes from './prescription.routes';
import adminRoutes from './admin.routes';
import appointmentRoutes from './appointment.routes';


const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));
router.use('/auth', authRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/admin', adminRoutes);
router.use('/appointments', appointmentRoutes);

// TODO (workstreams §8):
// router.use('/prescriptions', prescriptionRoutes);
// router.use('/documents', documentRoutes);
// router.use('/admin', adminRoutes);

export default router;
