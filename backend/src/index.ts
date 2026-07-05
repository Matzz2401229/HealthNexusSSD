/**
 * HealthNexus backend entrypoint (§9).
 * Wires the security middleware stack in front of the routes, in order:
 *   security headers -> body/cookie parsing -> CSRF -> routes -> 404 -> errors.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import { logger } from './utils/logger';
import { securityHeaders } from './middleware/securityHeaders';
import { csrfProtection } from './middleware/csrf';
import { errorHandler, notFound } from './middleware/errorHandler';
import { devAuth } from './middleware/devAuth';
import { sessionMiddleware } from './config/session';
import routes from './routes';

const app = express();

// Trust the nginx reverse proxy so req.ip / secure cookies work correctly.
app.set('trust proxy', 1);

app.use(securityHeaders);
app.use(cookieParser());
app.use(sessionMiddleware);
app.use(devAuth);
app.use(express.json({ limit: '1mb' }));
app.use(csrfProtection);

app.use('/', routes);

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  logger.info(`HealthNexus backend listening on port ${config.port}`, { env: config.nodeEnv });
});

export default app;
