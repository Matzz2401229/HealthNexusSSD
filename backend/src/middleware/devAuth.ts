import { Request, Response, NextFunction } from 'express';
import { AuthenticatedUser, Role } from './auth';

const DEV_USER_ID = 'x-dev-user-id';
const DEV_USER_ROLE = 'x-dev-user-role';
const ALLOWED_ROLES: Role[] = ['patient', 'doctor', 'pharmacist', 'admin'];

/**
 * Local-only auth shim so unfinished session work does not block secure module
 * development. Production ignores these headers completely.
 */
export function devAuth(req: Request, _res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'production' || req.user) {
    next();
    return;
  }

  const idHeader = req.get(DEV_USER_ID);
  const roleHeader = req.get(DEV_USER_ROLE);
  const userId = Number(idHeader);

  if (!Number.isInteger(userId) || userId <= 0) {
    next();
    return;
  }

  if (!roleHeader || !ALLOWED_ROLES.includes(roleHeader as Role)) {
    next();
    return;
  }

  req.user = {
    id: userId,
    role: roleHeader as AuthenticatedUser['role'],
  };

  next();
}
