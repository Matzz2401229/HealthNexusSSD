import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as adminController from '../controllers/admin.controller';

const router = Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/pending-doctors', adminController.listPendingDoctors);
router.post('/pending-doctors/:id/approve', adminController.approveDoctor);
router.post('/pending-doctors/:id/reject', adminController.rejectDoctor);
router.get('/users', adminController.listUsers);
router.patch('/users/:id/status', adminController.toggleUserStatus);
router.delete('/users/:id', adminController.removeUser);
router.get('/audit-logs', adminController.listAuditLogs);
router.get('/activity', adminController.getActivitySummary);
router.get('/announcements', adminController.listAnnouncements);
router.post('/announcements', adminController.createAnnouncement);
router.patch('/announcements/:id', adminController.updateAnnouncement);

export default router;
