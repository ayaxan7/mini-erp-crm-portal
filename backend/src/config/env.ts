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
  jwtSecret: string;
  jwtExpiresIn: string;
  frontendUrl: string;
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
  jwtSecret: required('JWT_SECRET', process.env.JWT_SECRET),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};

export default env;