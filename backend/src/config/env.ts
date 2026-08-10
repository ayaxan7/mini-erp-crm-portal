import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env'),
});

export type NodeEnv = 'development' | 'test' | 'production';

export interface Env {
  nodeEnv: NodeEnv;
  port: number;
  databaseUrl: string;
  frontendUrl: string;
  firebaseProjectId?: string;
  firebaseClientEmail?: string;
  firebasePrivateKey?: string;
  firebaseConfigPath?: string;
}

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = (process.env.NODE_ENV as NodeEnv) || 'development';

const env: Env = {
  nodeEnv,
  port: Number(process.env.PORT) || 4000,
  databaseUrl:
    nodeEnv === 'test'
      ? process.env.TEST_DATABASE_URL || 'postgres://localhost:5432/crm_test'
      : required('DATABASE_URL', process.env.DATABASE_URL || 'postgres://localhost:5432/crm_dev'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || undefined,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || undefined,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY || undefined,
  firebaseConfigPath: process.env.FIREBASE_CREDENTIALS_PATH || undefined,
};

export default env;