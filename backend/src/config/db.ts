import pg from 'pg';
import env from './env.js';

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: env.nodeEnv === 'test' ? 5 : 10,
});

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error on idle Postgres client', err);
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as string[]);
}

export default pool;