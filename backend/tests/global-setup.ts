import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgres://localhost:5432/crm_test';
const url = new URL(TEST_DB_URL);
const dbName = url.pathname.slice(1);
const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'schema.sql'), 'utf-8');

export default async function globalSetup(): Promise<void> {
  const maintenance = new pg.Client({
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user: url.username || undefined,
    password: url.password || undefined,
    database: 'postgres',
  });
  await maintenance.connect();
  const res = await maintenance.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (res.rowCount === 0) {
    await maintenance.query(`CREATE DATABASE ${dbName}`);
  }
  await maintenance.end();

  const client = new pg.Client({ connectionString: TEST_DB_URL });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.query(schemaSql);
  await client.end();
}