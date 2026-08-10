import pg from 'pg';
import env from './env.js';

export interface Queryable {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]): Promise<pg.QueryResult<T>>;
}

pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: env.nodeEnv === 'test' ? 5 : 10,
});

pool.on('error', (err) => console.error('Unexpected error on idle Postgres client', err));

export function client(): Promise<pg.PoolClient> {
  return pool.connect();
}