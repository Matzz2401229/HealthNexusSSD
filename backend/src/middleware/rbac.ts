/**
 * Role-Based Access Control (D1 §9.2, FSR1–FSR6).
 * Enforced server-side on every endpoint; deny-by-default; least privilege.
 * Frontend role checks are NOT a security control.
 *
 * `requireRole` is the enforced gate for every role-restricted route: it checks
 * BOTH the role AND that the account is fully active (FSR5), so a *pending* or
 * *suspended* account is blocked even on a route that only calls requireRole
 * directly (as most feature routers in this codebase do — they don't all use
 * the composed `authorize()` helper below). This was previously a real gap:
 * routes wired with requireAuth + requireRole alone let pending/suspended
 * accounts through, because the active check lived in a separate middleware
 * (`requireActive`, auth.ts) that nothing called. Baking the check into
 * requireRole closes it retroactively for every existing route.
 *
 * `authorize()` remains available as the fuller composed guard for NEW routes
 * that also need an ownership/IDOR check.
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
    // Role/status come only from the server-established session (req.session.user), set by requireAuth.
    const user = req.session.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (user.status !== 'active') {
      // FSR5: a pending (unapproved) or suspended account gets zero role-gated
      // access, regardless of what role it holds.
      void recordAudit({
        userId: user.id,
        role: user.role,
        action: 'rbac.inactive_denied',
        target: `${req.method} ${req.originalUrl}`,
        ip: req.ip,
        result: 'failure',
      });
      res.status(403).json({ error: 'Your account is not active.' });
      return;
    }
    if (!allowed.includes(user.role)) {
      // Log the broken-access-control attempt (SR14/SR16) before denying.
      void recordAudit({
        userId: user.id,
        role: user.role,
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
