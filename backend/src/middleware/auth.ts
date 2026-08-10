import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthUser, Role } from '../types/index.js';

interface JwtPayload extends jwt.JwtPayload {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export function signToken(user: { id: number; name: string; email: string; role: Role }): string {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn } as jwt.SignOptions,
  );
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(ApiError.unauthorized('Authentication required — provide a Bearer token'));
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret) as JwtPayload;
    req.user = { id: payload.id, name: payload.name, email: payload.email, role: payload.role };
    next();
  } catch {
    next(ApiError.unauthorized('Invalid or expired token'));
  }
}

export function requireRole(...roles: Role[]) {
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
}

export function toAuthUser(user: { id: number; name: string; email: string; role: Role }): AuthUser {
  return user;
}