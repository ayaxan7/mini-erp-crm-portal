import { getFirebaseAuth } from '../config/firebase.js';

export interface AuthIdentity {
  uid: string;
  email: string | null;
  name: string | null;
}

export interface AuthTokenVerifier {
  verifyToken(token: string): Promise<AuthIdentity | null>;
}

export class FirebaseTokenVerifier implements AuthTokenVerifier {
  async verifyToken(token: string): Promise<AuthIdentity | null> {
    try {
      const decoded = await getFirebaseAuth().verifyIdToken(token, true);
      return { uid: decoded.uid, email: decoded.email ?? null, name: decoded.name ?? null };
    } catch {
      return null;
    }
  }
}