import pg from 'pg';
import env from './env.js';

export interface Queryable {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]): Promise<pg.QueryResult<T>>;
}

pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);

const SSL_MODES = new Set(['require', 'prefer', 'verify-ca', 'verify-full']);

export function sslConfig(connectionString: string): { rejectUnauthorized: boolean } | undefined {
  const sslmode = new URL(connectionString).searchParams.get('sslmode');
  return sslmode && SSL_MODES.has(sslmode) ? { rejectUnauthorized: false } : undefined;
}

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: sslConfig(env.databaseUrl),
  max: env.nodeEnv === 'test' ? 5 : 10,
});

pool.on('error', (err) => console.error('Unexpected error on idle Postgres client', err));

export function client(): Promise<pg.PoolClient> {
  return pool.connect();
}