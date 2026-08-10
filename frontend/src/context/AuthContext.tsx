import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { api } from '../services/api';
import { createGoogleProvider, getFirebaseAuth, isFirebaseConfigured } from '../firebase/client';
import type { Role, User } from '../types/domain';

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  can: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'crm.token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const loadProfile = useCallback(async (firebaseUser: { getIdToken: () => Promise<string> }): Promise<User> => {
    const token = await firebaseUser.getIdToken();
    localStorage.setItem(TOKEN_KEY, token);
    const res = await api.get<{ id: number; name: string; email: string; role: Role }>('/auth/me');
    return res.data!;
  }, []);

  const resolveSession = useCallback(
    async (firebaseUser: { getIdToken: () => Promise<string> } | null) => {
      if (!firebaseUser) {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setReady(true);
        return;
      }
      try {
        const profile = await loadProfile(firebaseUser);
        setUser(profile);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      } finally {
        setReady(true);
      }
    },
    [loadProfile],
  );

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setReady(true);
      return;
    }
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      void resolveSession(firebaseUser);
    });

    const onUnauthorized = () => {
      void firebaseSignOut(auth).catch(() => undefined);
    };
    window.addEventListener('crm:unauthorized', onUnauthorized);
    return () => {
      unsubscribe();
      window.removeEventListener('crm:unauthorized', onUnauthorized);
    };
  }, [resolveSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const auth = getFirebaseAuth();
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name || email.split('@')[0] });
    await credential.user.getIdToken(true);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    await signInWithPopup(auth, createGoogleProvider());
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(TOKEN_KEY);
    const auth = getFirebaseAuth();
    await firebaseSignOut(auth);
  }, []);

  const can = useCallback(
    (...roles: Role[]) => {
      if (!user) return false;
      if (user.role === 'ADMIN') return true;
      return roles.includes(user.role);
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, ready, signIn, signUp, signInWithGoogle, signOut, can }),
    [user, ready, signIn, signUp, signInWithGoogle, signOut, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}