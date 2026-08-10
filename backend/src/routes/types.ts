import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../types/index.js';

export interface AuthMiddleware {
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
  requireRole: (...roles: Role[]) => (req: Request, res: Response, next: NextFunction) => void;
}