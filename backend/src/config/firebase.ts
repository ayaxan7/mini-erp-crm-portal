import fs from 'node:fs';
import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import env from './env.js';

let firebaseAuth: Auth | undefined;

function loadServiceAccount(): ServiceAccount {
  if (env.firebaseConfigPath) {
    const raw = fs.readFileSync(env.firebaseConfigPath, 'utf-8');
    return JSON.parse(raw) as ServiceAccount;
  }
  if (!env.firebaseProjectId || !env.firebaseClientEmail || !env.firebasePrivateKey) {
    throw new Error(
      'Firebase Admin SDK is not configured. Set FIREBASE_CREDENTIALS_PATH (service account JSON) or ' +
        'FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.',
    );
  }
  return {
    projectId: env.firebaseProjectId,
    clientEmail: env.firebaseClientEmail,
    privateKey: env.firebasePrivateKey,
  };
}

export function getFirebaseAuth(): Auth {
  if (firebaseAuth) return firebaseAuth;
  const serviceAccount = loadServiceAccount();
  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) });
  }
  firebaseAuth = getAuth();
  return firebaseAuth;
}