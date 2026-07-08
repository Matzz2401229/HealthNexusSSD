import { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/AppError';
import { validatePasswordPolicy } from '../utils/password';
import * as profileService from '../services/profile.service';

/**
 * Profile controllers (FR4, D1 9.1). Identity is read only from
 * req.session.user (set by requireAuth) — never from a route param or the
 * request body — so every handler here operates on the caller's own record.
 */

const dobField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format.')
  .refine((s) => {
    const d = new Date(s);
    return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
  }, 'Date of birth must be a valid past date.');

const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Name is required.').max(120).optional(),
    dateOfBirth: dobField.optional(),
    specialty: z.string().trim().max(255).optional(),
    pharmacy: z.string().trim().max(255).optional(),
  })
  .strict('Unknown profile field.');

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(1).max(128),
});

function firstZodMessage(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Invalid request.';
}

/** GET /api/profile — view own profile (FR4). */
export async function getProfile(req: Request, res: Response): Promise<void> {
  const user = req.session.user!; // requireAuth guarantees this is set
  const profile = await profileService.getProfile(user.id, user.role);
  res.status(200).json({ profile });
}

/** PATCH /api/profile — update own profile (FR4). */
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, firstZodMessage(parsed.error));
  }

  const { fullName, dateOfBirth, specialty, pharmacy } = parsed.data;
  const fields: Record<string, string> = {};
  if (fullName !== undefined) fields.full_name = fullName;
  if (dateOfBirth !== undefined) fields.dob = dateOfBirth;
  if (specialty !== undefined) fields.specialty = specialty;
  if (pharmacy !== undefined) fields.pharmacy = pharmacy;

  if (Object.keys(fields).length === 0) {
    throw new AppError(400, 'No profile fields provided.');
  }

  const user = req.session.user!;
  await profileService.updateProfile(user.id, user.role, fields);
  const profile = await profileService.getProfile(user.id, user.role);
  if (typeof profile.full_name === 'string') {
    req.session.user = { ...user, fullName: profile.full_name };
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });
  }
  res.status(200).json({ message: 'Profile updated.', profile });
}

/** PATCH /api/profile/password — change own password (D1 9.1, FSR7). */
export async function changePassword(req: Request, res: Response): Promise<void> {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, firstZodMessage(parsed.error));
  }

  const policyErrors = validatePasswordPolicy(parsed.data.newPassword); // FSR7
  if (policyErrors.length > 0) {
    throw new AppError(400, policyErrors.join(' '));
  }

  const user = req.session.user!;
  await profileService.changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);
  res.status(200).json({ message: 'Password changed successfully.' });
}
