/**
 * The error contract -- mirrored from `backend/src/types/api.types.ts`.
 *
 * `code` is the stable half. The UI switches on it and it never changes.
 * `message` is for humans and may be reworded server-side freely.
 * `details` carries the structured payload that makes an error actionable: the
 * cycle path, the blocking dependents, the failing form fields.
 *
 * Rendering `details` well is most of what separates a good error experience from
 * a bad one, and it is why the backend returns it.
 */

export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  DUPLICATE_TASK_ID: 'DUPLICATE_TASK_ID',
  UNKNOWN_DEPENDENCY: 'UNKNOWN_DEPENDENCY',
  SELF_DEPENDENCY: 'SELF_DEPENDENCY',
  CYCLE_DETECTED: 'CYCLE_DETECTED',
  DEPENDENCY_CONFLICT: 'DEPENDENCY_CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** Client-side only: the request never reached the server. */
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

// --- Typed `details` payloads ------------------------------------------------
// The shape of `details` depends on the code. These narrow it at the point of
// use, so a component rendering a cycle can read `details.cyclePath` with the
// compiler's blessing instead of casting blind.

export interface FieldIssue {
  field: string;
  message: string;
}

export interface ValidationDetails {
  issues: FieldIssue[];
}

export interface CycleDetails {
  /** A closed loop: ['T1','T2','T3','T1'] -- first and last are the same. */
  cyclePath: string[];
}

export interface DependencyConflictDetails {
  taskId: string;
  dependentIds: string[];
}

export interface UnknownDependencyDetails {
  taskId: string;
  missingIds: string[];
}
