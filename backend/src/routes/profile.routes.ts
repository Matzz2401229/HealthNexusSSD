import { Router } from 'express';
import * as profileController from '../controllers/profile.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

/**
 * Profile routes (FR4, D1 9.1). Mounted at /api/profile by routes/index.ts.
 * Logout lives on the auth router (session lifecycle), not here.
 */

const router = Router();

router.get('/', requireAuth, asyncHandler(profileController.getProfile));
router.patch('/', requireAuth, asyncHandler(profileController.updateProfile));
router.patch('/password', requireAuth, asyncHandler(profileController.changePassword));

export default router;
