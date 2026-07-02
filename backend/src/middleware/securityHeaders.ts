/**
 * Application-level security headers (NFSR2, SR15).
 * nginx already sets these at the edge; helmet enforces them at the app in
 * case the backend is reached directly. CSP forbids inline scripts (FSR11).
 */
import helmet from 'helmet';
import { RequestHandler } from 'express';

export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"], // no 'unsafe-inline' — CSP forbids inline scripts
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
  hidePoweredBy: true, // no X-Powered-By / framework banner
});
