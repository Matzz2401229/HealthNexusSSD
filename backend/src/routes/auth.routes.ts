import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

/**
 * Auth routes — OWNER: IS (Adil). Mounted at /api/auth by app.ts.
 *
 * App-level rate limiting is defence-in-depth against brute-force / credential
 * stuffing (SR6, NFR3, D1 risk #2), complementing nginx rate limits at the edge
 * and the per-account lockout in the auth service.
 */

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // login attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

// Registration (FR1, FR2, D1 §9.8)
router.post('/register', registerLimiter, asyncHandler(authController.registerPatient));
router.post('/register/doctor', registerLimiter, asyncHandler(authController.registerDoctor));
router.post('/register/pharmacist', registerLimiter, asyncHandler(authController.registerPharmacist));

// Login / logout / session (FR3, SR2, D1 9.1)
router.post('/login', loginLimiter, asyncHandler(authController.login));
router.post('/logout', asyncHandler(authController.logout));
router.get('/me', requireAuth, asyncHandler(authController.me));

export default router;
