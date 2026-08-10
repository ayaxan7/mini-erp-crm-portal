import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import env from '../config/env.js';
import { pool } from '../config/db.js';
import { seedAll } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_SQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');

async function ensureDatabase(): Promise<void> {
  const url = new URL(env.databaseUrl);
  const dbName = url.pathname.slice(1);
  const maintenance = new pg.Client({
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user: url.username || undefined,
    password: url.password || undefined,
    database: 'postgres',
  });
  try {
    await maintenance.connect();
    const res = await maintenance.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    const safeName = /^[a-zA-Z0-9_]+$/.test(dbName) ? dbName : '';
    if (res.rowCount === 0 && safeName) {
      await maintenance.query(`CREATE DATABASE ${safeName}`);
      // eslint-disable-next-line no-console
      console.log(`Created database "${dbName}"`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`Database "${dbName}" already exists`);
    }
  } finally {
    await maintenance.end();
  }
}

export async function applySchema(truncateFirst: boolean): Promise<void> {
  const client = new pg.Client({ connectionString: env.databaseUrl });
  await client.connect();
  try {
    if (truncateFirst) {
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      // eslint-disable-next-line no-console
      console.log('Dropped & recreated public schema');
    }
    await client.query(SCHEMA_SQL);
    // eslint-disable-next-line no-console
    console.log('Schema applied');
  } finally {
    await client.end();
  }
}

export async function resetAll(): Promise<void> {
  await applySchema(true);
  await seedAll();
  // eslint-disable-next-line no-console
  console.log('Database seeded');
}

async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');
  const seedOnly = process.argv.includes('--seed-only');

  if (seedOnly) {
    await ensureDatabase();
    await seedAll();
    // eslint-disable-next-line no-console
    console.log('Seed data applied');
    await pool.end();
    return;
  }

  await ensureDatabase();
  await applySchema(reset);
  await seedAll();
  // eslint-disable-next-line no-console
  console.log('Setup complete.');
  await pool.end();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Setup failed:', err);
    process.exit(1);
  });
}