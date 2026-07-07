/**
 * Anti-CSRF protection (FSR12, SR19).
 * Double-submit token: a random token is issued in a readable cookie and must
 * be echoed in a header on every state-changing request (POST/PUT/PATCH/DELETE),
 * validated server-side. SameSite cookies are defence in depth.
 *
 * csrfProtection is wired globally in index.ts, so every state-changing
 * request needs a valid token pair to get through. attachCsrfToken() is the
 * other half: call it wherever a session is created (currently
 * auth.controller.ts's login) so the client actually has a token to echo
 * back. clearCsrfToken() pairs with logout's session destruction.
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config/env';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function issueCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashCsrfToken(token: string): string {
  return crypto
    .createHmac('sha256', config.session.secret)
    .update(token)
    .digest('hex');
}

/**
 * Issues a fresh CSRF token and sets it as a readable cookie (not httpOnly —
 * the frontend must read it to echo it back in the x-csrf-token header).
 * Call this at the same point a session is created (login).
 */
export function attachCsrfToken(req: Request, res: Response): string {
  const token = issueCsrfToken();
  req.session.csrfTokenHash = hashCsrfToken(token);
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: config.isProd(),
    sameSite: 'strict',
  });
  return token;
}

/** Clears the CSRF cookie. Call this alongside session destruction (logout). */
export function clearCsrfToken(res: Response): void {
  res.clearCookie(CSRF_COOKIE);
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);
  const sessionTokenHash = req.session.csrfTokenHash;

  if (
    !cookieToken ||
    !headerToken ||
    !sessionTokenHash ||
    !timingSafeEqual(cookieToken, headerToken) ||
    !timingSafeEqual(hashCsrfToken(headerToken), sessionTokenHash)
  ) {
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
