import { ZodError, type ZodSchema } from 'zod';
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = (result.error as ZodError).issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));
      next(ApiError.badRequest('Validation failed', details));
      return;
    }
    (req as unknown as Record<string, unknown>)[source === 'body' ? 'validatedBody' : `validated${source === 'query' ? 'Query' : 'Params'}`] =
      result.data;
    next();
  };
}