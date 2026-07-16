/**
 * Machine-readable error codes returned to the client.
 *
 * The frontend switches on `code`, never on `message`. Messages are for humans
 * and may change; codes are part of the API contract and must not.
 */
export const ErrorCode = {
  /** Request body, params or query failed structural validation (Zod). */
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  /** Requested task ID does not exist. */
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',

  /** No route matched the request URL. Distinct from a missing task. */
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',

  /** A task ID supplied on create already exists. */
  DUPLICATE_TASK_ID: 'DUPLICATE_TASK_ID',

  /** A dependency references a task ID that does not exist. */
  UNKNOWN_DEPENDENCY: 'UNKNOWN_DEPENDENCY',

  /** A task lists itself as a dependency. */
  SELF_DEPENDENCY: 'SELF_DEPENDENCY',

  /** The dependency graph contains a cycle; no valid plan exists. */
  CYCLE_DETECTED: 'CYCLE_DETECTED',

  /** Deletion blocked because other tasks depend on this one. */
  DEPENDENCY_CONFLICT: 'DEPENDENCY_CONFLICT',

  /** Unhandled failure. */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
