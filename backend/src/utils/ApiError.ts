export class ApiError extends Error {
  public readonly status: number;
  public readonly details?: { field: string; message: string }[];

  constructor(status: number, message: string, details?: { field: string; message: string }[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  static badRequest(message = 'Invalid request', details?: { field: string; message: string }[]): ApiError {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have permission to perform this action'): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, message);
  }

  static conflict(message = 'Resource conflict'): ApiError {
    return new ApiError(409, message);
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}