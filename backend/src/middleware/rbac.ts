/**
 * Role-Based Access Control (D1 §9.2, FSR1–FSR6).
 * Enforced server-side on every endpoint; deny-by-default; least privilege.
 * Frontend role checks are NOT a security control.
 *
 * `requireRole` is the coarse role gate. `authorize()` is the recommended
 * composed guard for protected routes: it chains auth -> active -> role ->
 * ownership in the correct order so `requireActive` can't be omitted by mistake
 * — a *pending* or *suspended* account otherwise slips past a bare requireRole,
 * which checks the role but not the account status (FSR5).
 *
 * Usage:
 *   router.get('/admin/users', requireAuth, requireRole('admin'), handler)
 *
 *   router.get('/appointments/:appointmentId',
 *     authorize({
 *       roles: ['patient', 'doctor'],
 *       ownership: { param: 'appointmentId', resolver: canAccessAppointment },
 *     }),
 *     handler)
 */
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { requireAuth, requireActive, Role } from './auth';
import { requireOwnership, OwnershipResolver } from './ownership';
import { recordAudit } from '../services/audit.service';

export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Role comes only from the server-established session (req.session.user), set by requireAuth.
    if (!req.session.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowed.includes(req.session.user.role)) {
      // Log the broken-access-control attempt (SR14/SR16) before denying.
      void recordAudit({
        userId: req.session.user.id,
        role: req.session.user.role,
        action: 'rbac.role_denied',
        target: `${req.method} ${req.originalUrl}`,
        ip: req.ip,
        result: 'failure',
      });
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }
    next();
  };
}

export interface AuthorizeOptions {
  /** Roles permitted on the route. Omit to allow any authenticated user. */
  roles?: Role[];
  /** Require a fully-active account (blocks pending/suspended). Defaults to true. */
  active?: boolean;
  /** Per-request IDOR / ownership check against a route param. */
  ownership?: { param: string; resolver: OwnershipResolver };
}

/**
 * Build the composed authorisation middleware chain for a protected route.
 * Order (all deny-by-default): authenticated -> active -> role -> ownership.
 * Express flattens the returned array, so drop it straight into a route:
 *   router.post('/records/:patientId',
 *     authorize({ roles: ['doctor'], ownership: { param: 'patientId', resolver: canAccessPatientRecord } }),
 *     handler)
 */
export function authorize(options: AuthorizeOptions = {}): RequestHandler[] {
  const chain: RequestHandler[] = [requireAuth];

  // Active-account check is on by default; opt out only for endpoints that must
  // be reachable by a pending account (there are none in the current design).
  if (options.active !== false) {
    chain.push(requireActive);
  }

  if (options.roles && options.roles.length > 0) {
    chain.push(requireRole(...options.roles));
  }

  if (options.ownership) {
    chain.push(requireOwnership(options.ownership.param, options.ownership.resolver));
  }

  return chain;
}
