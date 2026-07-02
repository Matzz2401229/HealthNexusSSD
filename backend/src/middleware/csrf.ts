/**
 * Anti-CSRF protection (FSR12, SR19).
 * Double-submit token: a random token is issued in a readable cookie and must
 * be echoed in a header on every state-changing request (POST/PUT/PATCH/DELETE),
 * validated server-side. SameSite cookies are defence in depth.
 *
 * SKELETON: token issuance is stubbed; wire it to session creation.
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function issueCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);

  if (!cookieToken || !headerToken || !timingSafeEqual(cookieToken, headerToken)) {
    res.status(403).json({ error: 'Invalid or missing CSRF token.' });
    return;
  }
  next();
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export const csrfCookieName = CSRF_COOKIE;
