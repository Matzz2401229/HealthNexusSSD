import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { SessionUser } from '../types/session';

export type Role = SessionUser['role'];

/**
 * Authentication guards (auth workstream).
 * Identity/role/status come from `req.session.user` — the server-side session
 * — and NEVER from client-supplied input (FSR2). Deny-by-default (SR1).
 */

/** Requires any authenticated user. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session.user) {
    throw new AppError(401, 'Authentication required.');
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
  if (user.status !== 'active') {
    throw new AppError(403, 'Your account is not active.');
  }
  next();
}
