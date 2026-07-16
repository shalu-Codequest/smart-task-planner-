import type { ErrorCode } from '../errors/error-codes.js';

/**
 * The error envelope. This is a public API contract -- the frontend depends on
 * this exact shape, so it lives in a types file rather than being constructed
 * ad hoc inside the error handler.
 *
 * `code` is the stable, machine-readable half. Clients switch on it and it must
 * not change. `message` is for humans and may be reworded freely. `details` is
 * an optional structured payload whose shape depends on the code -- for
 * CYCLE_DETECTED it carries the cycle path, for DEPENDENCY_CONFLICT the
 * blocking dependents, for VALIDATION_ERROR the per-field issues.
 *
 * That `details` field is the difference between an error the user can act on
 * and one they can only be frustrated by.
 */
export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

/** A single field-level validation failure, as reported by Zod. */
export interface FieldIssue {
  /** Dotted path to the offending field, e.g. 'dependencies.0'. */
  field: string;
  message: string;
}
