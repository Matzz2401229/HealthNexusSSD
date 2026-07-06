import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { SessionUser } from '../types/session';
import { config } from '../config/env';

export type Role = SessionUser['role'];

/**
 * Authentication guards (auth workstream).
 * Identity/role/status come from `req.session.user` — the server-side session
 * — and NEVER from client-supplied input (FSR2). Deny-by-default (SR1).
 */

// NFSR5: absolute session timeout — regardless of activity. This is separate
// from the idle timeout, which the rolling session cookie (config/session.ts)
// already handles.
const ABSOLUTE_TIMEOUT_MS = config.session.absoluteTimeoutHr * 60 * 60 * 1000;

function isAbsoluteTimeoutExceeded(user: SessionUser): boolean {
  return Date.now() - user.loginAt > ABSOLUTE_TIMEOUT_MS;
}

/** Destroys an expired session server-side (D1 9.1) and denies the request. */
function rejectExpiredSession(req: Request): never {
  req.session.destroy(() => {});
  throw new AppError(401, 'Authentication required.');
}
/** Requires any authenticated user. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const user = req.session.user;
  if (!user) {
    throw new AppError(401, 'Authentication required.');
  }
  if (isAbsoluteTimeoutExceeded(user)) {
    rejectExpiredSession(req);
  }
  next();
}

/**
 * Requires an authenticated user whose account is fully active. This is what
 * blocks a *pending* doctor from reaching patient-facing features while their
 * approval is still outstanding (FSR5).
 */
export function requireActive(req: Request, _res: Response, next: NextFunction): void {
  const user = req.session.user;
  if (!user) {
    throw new AppError(401, 'Authentication required.');
  }
  if (isAbsoluteTimeoutExceeded(user)) {
    rejectExpiredSession(req);
  }
  if (user.status !== 'active') {
    throw new AppError(403, 'Your account is not active.');
  }
  next();
}
