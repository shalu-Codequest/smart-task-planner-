import type { NextFunction, Request, Response } from 'express';
import type { ZodError, ZodSchema } from 'zod';

import { AppError } from '../errors/AppError.js';
import type { FieldIssue } from '../types/api.types.js';

/** Which part of the request the schema applies to. */
type RequestPart = 'body' | 'params' | 'query';

/**
 * Generic Zod validation middleware.
 *
 * The middleware validates the request payload, applies schema transforms, and
 * forwards failures to the shared error handler.
 */
export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      next(
        AppError.validation('Request validation failed.', {
          issues: toFieldIssues(result.error),
        }),
      );
      return;
    }

    // Replace the raw request value with the parsed result so downstream code
    // sees normalized data rather than the unvalidated input.
    req[part] = result.data as never;

    next();
  };
}

/**
 * Flattens a ZodError into a list of field-level issues.
 *
 * Returns every issue, not just the first. A form with three bad fields should
 * light up all three at once -- making the user submit, fix one, resubmit, fix
 * the next is a bad experience and it is entirely avoidable since Zod already
 * collected them all.
 *
 * `path` is joined with dots so a nested failure reads as 'dependencies.0', which
 * the frontend can map directly onto a form field.
 */
function toFieldIssues(error: ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}
