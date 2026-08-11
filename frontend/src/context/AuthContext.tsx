import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../services/api';
import { ApiError } from '../types/api';
import type { Role, User } from '../types/domain';

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'crm.token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const applySession = useCallback((user: User | null, token?: string) => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setUser(user);
  }, []);

  const logout = useCallback(() => {
    applySession(null);
  }, [applySession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
      applySession(res.data!.user, res.data!.token);
    },
    [applySession],
  );

  const can = useCallback(
    (...roles: Role[]) => {
      if (!user) return false;
      if (user.role === 'ADMIN') return true;
      return roles.includes(user.role);
    },
    [user],
  );

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem(TOKEN_KEY);

    const validate = async () => {
      if (!token) {
        setReady(true);
        return;
      }
      try {
        const res = await api.get<{ id: number; name: string; email: string; role: Role }>('/auth/me');
        if (!cancelled) setUser(res.data!);
      } catch (err) {
        if (!(err instanceof ApiError)) throw err;
        if (!cancelled) localStorage.removeItem(TOKEN_KEY);
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    const onUnauthorized = () => {
      if (!cancelled) {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      }
    };

    void validate();
    window.addEventListener('crm:unauthorized', onUnauthorized);
    return () => {
      cancelled = true;
      window.removeEventListener('crm:unauthorized', onUnauthorized);
    };
  }, []);

  const value = useMemo(() => ({ user, ready, login, logout, can }), [user, ready, login, logout, can]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}