/**
 * Operational request logging.
 * Logs only metadata required for troubleshooting.
 * Never logs request bodies, cookies, tokens, passwords, query strings,
 * or clinical content.
 */
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = crypto.randomUUID();
  const startedAt = process.hrtime.bigint();

  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    const meta = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ip: req.ip,
    };

    if (res.statusCode >= 500) {
      logger.error('HTTP request completed', meta);
    } else if (res.statusCode >= 400) {
      logger.warn('HTTP request completed', meta);
    } else {
      logger.info('HTTP request completed', meta);
    }
  });

  next();
}