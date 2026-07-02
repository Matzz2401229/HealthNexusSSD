/**
 * Auth controller — thin HTTP layer over auth.service (D1 §9.1).
 * Keeps error messages generic to avoid user enumeration.
 */
import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { recordAudit } from '../services/audit.service';

const GENERIC_LOGIN_ERROR = 'Invalid credentials.';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, role } = req.body;
    const result = await authService.register({ email, password, role });
    if (!result.ok) {
      res.status(400).json({ error: result.error ?? 'Registration failed.' });
      return;
    }
    res.status(201).json({ message: 'Registration received. Please verify your email.' });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    await recordAudit({
      userId: null,
      role: null,
      action: 'login',
      target: email,
      ip: req.ip,
      result: result.ok ? 'success' : 'failure',
    });

    if (!result.ok || !result.sessionId) {
      // Same generic message for every failure mode (no enumeration).
      res.status(401).json({ error: GENERIC_LOGIN_ERROR });
      return;
    }

    // Session cookie: Secure + HttpOnly + SameSite; no sensitive data inside.
    res.cookie('session', result.sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000, // absolute 8h cap
    });
    res.json({ message: 'Logged in.' });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // TODO: invalidate the server-side session record so the token can't be replayed.
    res.clearCookie('session');
    res.json({ message: 'Logged out.' });
  } catch (err) {
    next(err);
  }
}
