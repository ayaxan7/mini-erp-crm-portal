import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { AuthService } from '../services/auth.service.js';
import type { AuthMiddleware } from '../routes/types.js';
import type { AuthUser, Role } from '../types/index.js';

export function createAuthMiddleware(authService: AuthService): AuthMiddleware {
  const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Authentication required — provide a Bearer token');
    }
    const user = await authService.authenticate(header.slice(7));
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role } satisfies AuthUser;
    next();
  });

  const requireRole = (...roles: Role[]) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
      if (!req.user) {
        next(ApiError.unauthorized('Authentication required'));
        return;
      }
      if (!roles.includes(req.user.role)) {
        next(ApiError.forbidden(`Role ${req.user.role} is not allowed to perform this action`));
        return;
      }
      next();
    };
  };

  return { requireAuth, requireRole };
}