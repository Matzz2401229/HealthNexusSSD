import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as adminController from '../controllers/admin.controller';

const router = Router();

router.use(requireAuth);
// router.use(requireRole('admin'));

router.get('/pending-doctors', requireRole('admin'), adminController.listPendingDoctors);
router.post('/pending-doctors/:id/approve', requireRole('admin'), adminController.approveDoctor);
router.post('/pending-doctors/:id/reject', requireRole('admin'),adminController.rejectDoctor);

router.get('/users', requireRole('admin'), adminController.listUsers);
router.patch('/users/:id/status', requireRole('admin'), adminController.toggleUserStatus);
router.delete('/users/:id', requireRole('admin'), adminController.removeUser);
router.post('/users', requireRole('admin'), adminController.createUser);

router.get('/audit-logs', requireRole('admin'), adminController.listAuditLogs);
router.get('/activity', requireRole('admin'), adminController.getActivitySummary);


router.post('/announcements', requireRole('admin'), adminController.createAnnouncement);
router.patch('/announcements/:id', requireRole('admin'), adminController.updateAnnouncement);
router.delete('/announcements/:id', requireRole('admin'), adminController.deleteAnnouncement);

router.get('/announcements', adminController.listAnnouncements);

export default router;
