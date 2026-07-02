/**
 * Role-Based Access Control (D1 §9.2, FSR1–FSR6).
 * Enforced server-side on every endpoint; deny-by-default; least privilege.
 * Frontend role checks are NOT a security control.
 *
 * Usage:  router.get('/admin/users', requireAuth, requireRole('admin'), handler)
 */
import { Request, Response, NextFunction } from 'express';
import { Role } from './auth';

export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Role comes only from the server-established session (req.user), set by requireAuth.
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowed.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }
    next();
  };
}
