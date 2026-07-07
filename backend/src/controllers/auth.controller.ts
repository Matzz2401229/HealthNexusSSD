import 'express-session';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/AppError';
import { validatePasswordPolicy } from '../utils/password';
import { attachCsrfToken, clearCsrfToken } from '../middleware/csrf';
import * as authService from '../services/auth.service';
import { recordAudit } from '../services/audit.service';

/**
 * Auth controllers — OWNER: IS (Adil)
 * Translate HTTP <-> the auth service: validate input (SR5, D1 9.5), enforce
 * the FSR7 password policy, manage the session lifecycle, and return only
 * generic, safe messages to the client.
 */

// --- Request schemas (SR5). Password *complexity* is checked separately. ---
const emailField = z.string().trim().toLowerCase().email('A valid email address is required.').max(254);
const nameField = z.string().trim().min(1, 'Name is required.').max(120);
const passwordField = z.string().min(1).max(128);
const dobField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format.')
  .refine((s) => {
    const d = new Date(s);
    return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
  }, 'Date of birth must be a valid past date.');

const registerPatientSchema = z.object({
  name: nameField,
  dateOfBirth: dobField,
  email: emailField,
  password: passwordField,
});

const registerDoctorSchema = registerPatientSchema.omit({ dateOfBirth: true }).extend({
  specialty: z.string().trim().max(255).optional(),
});

const registerPharmacistSchema = registerPatientSchema.omit({ dateOfBirth: true }).extend({
  pharmacy: z.string().trim().max(255).optional(),
});

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1).max(128),
});

function firstZodMessage(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Invalid request.';
}

/** POST /api/auth/register  (patient self-registration, FR1) */
export async function registerPatient(req: Request, res: Response): Promise<void> {
  const parsed = registerPatientSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, firstZodMessage(parsed.error));
  }

  const policyErrors = validatePasswordPolicy(parsed.data.password); // FSR7
  if (policyErrors.length > 0) {
    throw new AppError(400, policyErrors.join(' '));
  }

  await authService.registerPatient(parsed.data as authService.RegisterPatientInput);
  res.status(201).json({ message: 'Registration successful. You can now log in.' });
}

/** POST /api/auth/register/doctor  (doctor self-registration, FR2 / FSR5) */
export async function registerDoctor(req: Request, res: Response): Promise<void> {
  const parsed = registerDoctorSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, firstZodMessage(parsed.error));
  }

  const policyErrors = validatePasswordPolicy(parsed.data.password);
  if (policyErrors.length > 0) {
    throw new AppError(400, policyErrors.join(' '));
  }

  await authService.registerDoctor(parsed.data as authService.RegisterDoctorInput);
  res.status(201).json({
    message: 'Doctor registration submitted. Your account is pending admin approval.',
  });
}

/** POST /api/auth/register/pharmacist  (pharmacist self-registration, pending admin approval — D1 §9.8) */
export async function registerPharmacist(req: Request, res: Response): Promise<void> {
  const parsed = registerPharmacistSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, firstZodMessage(parsed.error));
  }

  const policyErrors = validatePasswordPolicy(parsed.data.password);
  if (policyErrors.length > 0) {
    throw new AppError(400, policyErrors.join(' '));
  }

  await authService.registerPharmacist(parsed.data as authService.RegisterPharmacistInput);
  res.status(201).json({
    message: 'Pharmacist registration submitted. Your account is pending admin approval.',
  });
}

/** POST /api/auth/login  (FR3, SR2) */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError(400, 'Invalid request.');
  }

  try {
    const sessionUser = await authService.login(
      parsed.data.email,
      parsed.data.password,
    );

    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });

    req.session.user = sessionUser;

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    attachCsrfToken(res);

    await recordAudit({
      userId: sessionUser.id,
      role: sessionUser.role,
      action: 'login',
      target: parsed.data.email,
      ip: req.ip,
      result: 'success',
    });

    res.status(200).json({
      message: 'Login successful.',
      user: sessionUser,
    });

  } catch (err) {

    await recordAudit({
      userId: null,
      role: null,
      action: 'login',
      target: parsed.data.email,
      ip: req.ip,
      result: 'failure',
    });

    next(err);
  }
}

/** POST /api/auth/logout  (D1 9.1: server-side session invalidation) */
export async function logout(req: Request, res: Response): Promise<void> {
  const sessionUser = req.session.user;

  await new Promise<void>((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });

  res.clearCookie('hn.sid');
  clearCsrfToken(res);

  await recordAudit({
    userId: sessionUser?.id ?? null,
    role: sessionUser?.role ?? null,
    action: 'auth.logout',
    target: sessionUser ? `user:${sessionUser.id}` : 'auth/logout',
    ip: req.ip,
    result: 'success',
  });

  res.status(200).json({ message: 'Logged out.' });
}

/** GET /api/auth/me — current session user (from the server-side session only). */
export async function me(req: Request, res: Response): Promise<void> {
  if (!req.session.user) {
    throw new AppError(401, 'Authentication required.');
  }

  res.status(200).json({ user: req.session.user });
}