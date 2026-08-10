import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui/State';
import type { Role } from '../types/domain';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return <Spinner label="Loading your workspace…" />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role !== 'ADMIN' && !roles.includes(user.role)) {
    return (
      <div>
        <h2>Not permitted</h2>
        <p className="text-secondary">Your role does not allow access to this area.</p>
      </div>
    );
  }
  return <>{children}</>;
}