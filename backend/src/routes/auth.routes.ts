/**
 * Auth routes (D1 §9.1). Validation runs before the controller; login is
 * additionally rate-limited (brute-force defence, layered with nginx).
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as authController from '../controllers/auth.controller';

const router = Router();

// Account-level brute-force limit (nginx also rate-limits by IP at the edge).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // lockout threshold from D1 §9.1
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' },
});

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(12).max(200),
  role: z.enum(['patient', 'doctor', 'pharmacist', 'admin']),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
});

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/logout', authController.logout);

export default router;
