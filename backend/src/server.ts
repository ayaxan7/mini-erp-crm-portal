import env from './config/env.js';
import { pool } from './config/db.js';
import { createApp } from './app.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down gracefully…`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));