/**
 * Route aggregator. Mount feature routers here as each workstream lands
 * (appointments, prescriptions, documents, admin, ...), all behind
 * requireAuth + requireRole + ownership checks.
 */
import { Router } from 'express';
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);

// TODO (workstreams §8):
// router.use('/appointments', appointmentRoutes);
// router.use('/prescriptions', prescriptionRoutes);
// router.use('/documents', documentRoutes);
// router.use('/admin', adminRoutes);

export default router;
