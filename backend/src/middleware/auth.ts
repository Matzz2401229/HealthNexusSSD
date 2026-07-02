/**
 * Authentication middleware (D1 §9.1).
 * Establishes WHO the request is from, using ONLY the server-side session.
 * Identity/role are never read from client-supplied params/headers/body.
 *
 * SKELETON: wire this to the real session store (auth.service.ts). The shape
 * below is what downstream rbac/ownership middleware expect on req.user.
 */
import { Request, Response, NextFunction } from 'express';

export type Role = 'patient' | 'doctor' | 'pharmacist' | 'admin';

export interface AuthenticatedUser {
  id: number;
  role: Role;
}

// Augment Express's Request with the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Deny-by-default: reject unless a valid server-side session resolves to a user.
 * Generic 401 message — no detail that aids enumeration.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // TODO: look up session from the Secure/HttpOnly/SameSite cookie, validate
  // it against the server-side session store, enforce idle (15m) + absolute
  // (8h) timeouts, then attach req.user.
  const user = resolveSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  req.user = user;
  next();
}

/** Placeholder session resolver — replace with the real session store lookup. */
function resolveSessionUser(_req: Request): AuthenticatedUser | null {
  // TODO: implement in the Auth & session workstream.
  return null;
}
