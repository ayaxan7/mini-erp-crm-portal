import type { NextFunction, Request, Response } from 'express';
import { isApiError } from '../utils/ApiError.js';
import env from '../config/env.js';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ success: false, message: 'Route not found' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (isApiError(err)) {
    res.status(err.status).json({ success: false, message: err.message, errors: err.details });
    return;
  }

  if ((err as { code?: string })?.code === '23505') {
    res.status(409).json({ success: false, message: 'Duplicate value violates a unique constraint' });
    return;
  }

  if ((err as { code?: string })?.code === '22P02') {
    res.status(400).json({ success: false, message: 'Invalid value provided for a database field' });
    return;
  }

  console.error('[UnhandledError]', err);
  const message = env.nodeEnv === 'production' ? 'Internal server error' : String((err as Error)?.message || err);
  res.status(500).json({ success: false, message });
}