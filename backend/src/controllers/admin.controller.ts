import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as adminService from '../services/admin.service';
import { recordAudit } from '../services/audit.service';
import { validatePasswordPolicy } from '../utils/password';
import { AppError } from '../utils/AppError';

const idParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const toggleUserStatusSchema = z.object({
  isActive: z.boolean(),
});

const createUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
  role: z.enum(['patient', 'doctor', 'pharmacist', 'admin']),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  specialty: z.string().trim().min(1).max(255).optional(),
  pharmacy: z.string().trim().min(1).max(255).optional(),
}).superRefine((value, ctx) => {
  if (value.role === 'patient' && !value.dateOfBirth) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Date of birth is required.', path: ['dateOfBirth'] });
  }
  if (value.role === 'doctor' && !value.specialty) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Specialty is required.', path: ['specialty'] });
  }
  if (value.role === 'pharmacist' && !value.pharmacy) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Pharmacy is required.', path: ['pharmacy'] });
  }
});

const announcementSchema = z.object({
  title: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1).max(5000),
});

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid request.');
  }
  return parsed.data;
}

export async function listPendingDoctors(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.listPendingDoctors();
    await recordAudit({
      userId: req.session.user?.id ?? null,
      role: req.session.user?.role ?? null,
      action: 'admin.list_pending_doctors',
      target: 'doctor_registrations',
      ip: req.ip,
      result: 'success',
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function approveDoctor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = parseOrThrow(idParamsSchema, req.params);
    const adminId = req.session.user?.id;

    if (!adminId) {
    res.status(401).json({ error: 'Unauthenticated.' });
    return;
    }

    const ok = await adminService.approveDoctor(id, adminId);

    if (!ok) {
      res.status(500).json({ error: 'Failed to approve registration.' });
      return;
    }
    await recordAudit({
      userId: req.session.user?.id ?? null,
      role: req.session.user?.role ?? null,
      action: 'admin.approve_doctor',
      target: `doctor_registrations:${id}`,
      ip: req.ip,
      result: 'success',
    });
    res.json({ message: 'Registration approved.' });
  } catch (err) {
    next(err);
  }
}

export async function rejectDoctor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = parseOrThrow(idParamsSchema, req.params);
    const ok = await adminService.rejectDoctor(id);
    if (!ok) {
      res.status(500).json({ error: 'Failed to reject registration.' });
      return;
    }
    await recordAudit({
      userId: req.session.user?.id ?? null,
      role: req.session.user?.role ?? null,
      action: 'admin.reject_doctor',
      target: `doctor_registrations:${id}`,
      ip: req.ip,
      result: 'success',
    });
    res.json({ message: 'Registration rejected.' });
  } catch (err) {
    next(err);
  }
}

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.listUsers();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function toggleUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = parseOrThrow(idParamsSchema, req.params);
    const { isActive } = parseOrThrow(toggleUserStatusSchema, req.body);
    const ok = await adminService.updateUserStatus(id, isActive);
    if (!ok) {
      res.status(500).json({ error: 'Failed to update user status.' });
      return;
    }

    await recordAudit({
      userId: req.session.user?.id ?? null,
      role: req.session.user?.role ?? null,
      action: isActive ? 'admin.reactivate_user' : 'admin.suspend_user',
      target: `user:${id}`,
      ip: req.ip,
      result: 'success',
    });

    res.json({ message: 'User status updated.' });
  } catch (err) {
    next(err);
  }
}

export async function createUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = parseOrThrow(createUserSchema, req.body);

    const passwordErrors = validatePasswordPolicy(input.password);

    if (passwordErrors.length > 0) {
      res.status(400).json({
        error: passwordErrors.join(' ')
      });
      return;
    }

    const ok = await adminService.createUser({
      name: input.name,
      email: input.email,
      password: input.password,
      role: input.role,
      dateOfBirth: input.dateOfBirth,
      specialty: input.specialty,
      pharmacy: input.pharmacy,
    });

    if (!ok) {
      res.status(500).json({ error: 'Failed to create user.' });
      return;
    }

    await recordAudit({
      userId: req.session.user?.id ?? null,
      role: req.session.user?.role ?? null,
      action: 'admin.create_user',
      target: input.email,
      ip: req.ip,
      result: 'success',
    });

    res.status(201).json({
      message: 'User created.',
    });

  } catch (err) {
    next(err);
  }
}

export async function removeUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = parseOrThrow(idParamsSchema, req.params);
    const ok = await adminService.deleteUser(id);
    if (!ok) {
      res.status(500).json({ error: 'Failed to remove user.' });
      return;
    }

    await recordAudit({
      userId: req.session.user?.id ?? null,
      role: req.session.user?.role ?? null,
      action: 'admin.delete_user',
      target: `user:${id}`,
      ip: req.ip,
      result: 'success',
    });

    res.json({ message: 'User removed.' });
  } catch (err) {
    next(err);
  }
}

export async function listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.listAuditLogs();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getActivitySummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.getActivitySummary();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getAdminOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.getAdminOverview();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function listAnnouncements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.listAnnouncements();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = parseOrThrow(announcementSchema, req.body);
    const ok = await adminService.createAnnouncement(input, req.session.user?.id ?? 0);
    if (!ok) {
      res.status(500).json({ error: 'Failed to publish announcement.' });
      return;
    }

    await recordAudit({
      userId: req.session.user?.id ?? null,
      role: req.session.user?.role ?? null,
      action: 'admin.create_announcement',
      target: `announcement:${input.title}`,
      ip: req.ip,
      result: 'success',
    });

    res.status(201).json({ message: 'Announcement published.' });
  } catch (err) {
    next(err);
  }
}

export async function updateAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = parseOrThrow(idParamsSchema, req.params);
    const input = parseOrThrow(announcementSchema, req.body);
    const ok = await adminService.updateAnnouncement(id, input);
    if (!ok) {
      res.status(500).json({ error: 'Failed to update announcement.' });
      return;
    }

    await recordAudit({
      userId: req.session.user?.id ?? null,
      role: req.session.user?.role ?? null,
      action: 'admin.update_announcement',
      target: `announcement:id=${id}|title=${input.title}`,
      ip: req.ip,
      result: 'success',
    });
    
    res.json({ message: 'Announcement updated.' });
  } catch (err) {
    next(err);
  }
}


export async function deleteAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = parseOrThrow(idParamsSchema, req.params);

    const ok = await adminService.deleteAnnouncement(id);

    if (!ok) {
      res.status(500).json({ error: 'Failed to delete announcement.' });
      return;
    }

    await recordAudit({
      userId: req.session.user?.id ?? null,
      role: req.session.user?.role ?? null,
      action: 'admin.delete_announcement',
      target: `announcement:id=${id}`,
      ip: req.ip,
      result: 'success',
    });

    res.json({ message: 'Announcement deleted.' });
  } catch (err) {
    next(err);
  }
}
