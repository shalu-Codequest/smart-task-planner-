import type { NextFunction, Request, Response } from 'express';

import { config } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { ErrorCode } from '../errors/error-codes.js';
import type { ApiErrorResponse } from '../types/api.types.js';

/**
 * Handles requests that matched no route.
 * This runs after the routers and returns the same JSON error envelope as other
 * failures so clients can handle them consistently.
 */
export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiErrorResponse = {
    error: {
      code: ErrorCode.ROUTE_NOT_FOUND,
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  };

  res.status(404).json(body);
}

/**
 * Central error handler for the application.
 * Domain errors are mapped to HTTP responses here. Unexpected failures are logged
 * and returned as a generic 500 to avoid leaking internal details.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof AppError) {
    const body: ApiErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    };

    res.status(error.statusCode).json(body);
    return;
  }

  // express.json() surfaces a malformed payload as a SyntaxError tagged with
  // `body` and `status`. Matching on those fields distinguishes it from an
  // unrelated SyntaxError thrown inside a handler, which is a genuine 500.
  if (
    error instanceof SyntaxError &&
    'body' in error &&
    'status' in error &&
    (error as { status: number }).status === 400
  ) {
    const body: ApiErrorResponse = {
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Request body is not valid JSON.',
      },
    };

    res.status(400).json(body);
    return;
  }

  console.error('[unhandled error]', error);

  const body: ApiErrorResponse = {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred.',
      ...(config.exposeInternalErrors && error instanceof Error
        ? { details: { message: error.message } }
        : {}),
    },
  };

  res.status(500).json(body);
}
