import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

function readConfig(): object | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  if (!apiKey) return null;
  return {
    apiKey,
    authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) ?? null,
    projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ?? null,
    appId: (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined) ?? null,
  };
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(readConfig());
}

export function getFirebaseAuth(): Auth {
  const config = readConfig();
  if (!config) throw new Error('Firebase is not configured. Add the VITE_FIREBASE_* environment variables.');
  if (!app) app = initializeApp(config);
  if (!auth) auth = getAuth(app);
  return auth;
}

export function createGoogleProvider(): GoogleAuthProvider {
  return new GoogleAuthProvider();
}

export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please sign in instead.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Invalid email or password.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in Firebase.';
    case 'auth/network-request-failed':
      return 'Network error — please try again.';
    default:
      return 'Unable to sign in. Please try again.';
  }
}