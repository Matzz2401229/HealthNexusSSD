import session from 'express-session';
// @ts-ignore
import expressMySQLSession from 'express-mysql-session';
import { env } from './env';

const MySQLStore = expressMySQLSession(session);
// @ts-ignore - express-mysql-session has incomplete types

const store = new MySQLStore({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  createDatabaseTable: true,
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
    maxAge: 15 * 60 * 1000,
  },
});