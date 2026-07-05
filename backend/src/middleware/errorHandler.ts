/**
 * Centralised error handling (D1 §9.6, NFSR3).
 * Generic errors to the client; NO stack traces in production. Full detail is
 * logged server-side only. Must be registered LAST, after all routes.
 */
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { DocumentAccessError } from '../services/document.service';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof DocumentAccessError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unknown error';
  logger.error('Unhandled error', {
    message,
    method: req.method,
    path: req.path,
    // stack is logged server-side only, never returned to the client
    stack: err instanceof Error ? err.stack : undefined,
  });

  // Generic response — no internal detail, no stack trace leaked to clients.
  res.status(500).json({
    error: 'An unexpected error occurred.',
    ...(config.isProd() ? {} : { debug: message }),
  });
}

/** 404 fallback for unmatched routes. */
export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found.' });
}
