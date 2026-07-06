import { Request, Response, NextFunction } from 'express';
import * as adminService from '../services/admin.service';
import { recordAudit } from '../services/audit.service';

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
    const id = Number(req.params.id);
    const adminId = req.session.user?.id;

    if (!adminId) {
    res.status(401).json({ error: 'Unauthenticated.' });
    return;
    }
    console.log("Doctor ID:", id);
    console.log("Admin ID:", adminId);

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
    const id = Number(req.params.id);
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
    const id = Number(req.params.id);
    const { isActive } = req.body as { isActive?: boolean };
    const ok = await adminService.updateUserStatus(id, Boolean(isActive));
    if (!ok) {
      res.status(500).json({ error: 'Failed to update user status.' });
      return;
    }
    res.json({ message: 'User status updated.' });
  } catch (err) {
    next(err);
  }
}

export async function removeUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const ok = await adminService.deleteUser(id);
    if (!ok) {
      res.status(500).json({ error: 'Failed to remove user.' });
      return;
    }
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
    const { title, body } = req.body as { title?: string; body?: string };
    if (!title || !body) {
      res.status(400).json({ error: 'Title and body are required.' });
      return;
    }
    const ok = await adminService.createAnnouncement({ title, body }, req.session.user?.id ?? 0);
    if (!ok) {
      res.status(500).json({ error: 'Failed to publish announcement.' });
      return;
    }
    res.status(201).json({ message: 'Announcement published.' });
  } catch (err) {
    next(err);
  }
}

export async function updateAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { title, body } = req.body as { title?: string; body?: string };
    if (!title || !body) {
      res.status(400).json({ error: 'Title and body are required.' });
      return;
    }
    const ok = await adminService.updateAnnouncement(id, { title, body });
    if (!ok) {
      res.status(500).json({ error: 'Failed to update announcement.' });
      return;
    }
    res.json({ message: 'Announcement updated.' });
  } catch (err) {
    next(err);
  }
}
