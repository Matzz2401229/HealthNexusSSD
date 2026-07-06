import session from 'express-session';
// express-mysql-session ships no type declarations; the ambient .d.ts covers
// tsc, but ts-node-dev needs this suppression at runtime.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import expressMySQLSession from 'express-mysql-session';
import { env } from './env';

const MySQLStore = expressMySQLSession(session);

const store = new MySQLStore({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  // The `sessions` table is pre-created by db/init.sql so the restricted app
  // DB user doesn't need CREATE (SDR8 least-privilege). Don't auto-create it.
  createDatabaseTable: false,
  clearExpired: true,
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: 8 * 60 * 60 * 1000,
});

export const sessionMiddleware = session({
  name: 'hn.sid',
  secret: env.session.secret,
  store,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: env.isProd(),
    sameSite: 'strict',
    // NFSR5: idle timeout, in ms. Env-configurable, same as the absolute
    // timeout enforced separately in middleware/auth.ts.
    maxAge: env.session.idleTimeoutMin * 60 * 1000,
  },
});