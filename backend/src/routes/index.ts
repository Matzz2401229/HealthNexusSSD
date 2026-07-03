/**
 * Route aggregator. Mount feature routers here as each workstream lands
 * (appointments, prescriptions, documents, admin, ...), all behind
 * requireAuth + requireRole + ownership checks.
 */
import { Router } from 'express';
import authRoutes from './auth.routes';
import appointmentRoutes from './appointment.routes';


const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));
router.use('/auth', authRoutes);

// TODO (workstreams §8):
// router.use('/appointments', appointmentRoutes);
// router.use('/prescriptions', prescriptionRoutes);
// router.use('/documents', documentRoutes);
// router.use('/admin', adminRoutes);

export default router;
