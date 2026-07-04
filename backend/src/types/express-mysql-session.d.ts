declare module 'express-mysql-session' {
  import { Store } from 'express-session';

  interface MySQLStoreOptions {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    createDatabaseTable?: boolean;
    clearExpired?: boolean;
    checkExpirationInterval?: number;
    expiration?: number;
  }

  function MySQLStore(session: any): new (options: MySQLStoreOptions) => Store;

  export = MySQLStore;
}
