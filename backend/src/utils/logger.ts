/**
 * Minimal structured logger. NEVER log passwords, tokens, or clinical
 * content (D1 §9.3). Application audit events go through audit.service.ts,
 * not this logger.
 */
type Level = 'info' | 'warn' | 'error';

function emit(level: Level, message: string, meta?: Record<string, unknown>): void {
  const entry = { ts: new Date().toISOString(), level, message, ...(meta ?? {}) };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
};
