import { ErrorCode as Codes } from '../types/api.types';
import type {
  ApiErrorBody,
  CycleDetails,
  DependencyConflictDetails,
  ErrorCode,
  UnknownDependencyDetails,
  ValidationDetails,
} from '../types/api.types';

/**
 * The single error type the UI ever handles.
 *
 * Without it, every component that calls the API would have to know about Axios:
 *
 *     catch (e) {
 *       if (axios.isAxiosError(e) && e.response?.data?.error?.code === '...')
 *     }
 *
 * That is Axios's shape leaking into a button's click handler -- change HTTP
 * client and every component breaks. With it, `api/client.ts` is the only file in
 * the frontend that imports Axios; everything above catches `ApiError` and
 * switches on `code`.
 *
 * The type guards
 * ---------------
 * `details` is `unknown` because its shape depends on the code. The guards below
 * narrow it safely at the point of use, so a component can write:
 *
 *     if (error.isCycle()) renderCycle(error.cycleDetails());
 *
 * rather than casting and hoping. The cast happens once, here, behind a check --
 * not scattered across every component that touches an error.
 */
export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';

    // Restores the prototype chain, lost when extending Error under an ES target.
    // Without this, `instanceof ApiError` returns false and every typed catch
    // silently degrades to the generic branch.
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  // --- Narrowing helpers -----------------------------------------------------

  isCycle(): boolean {
    return this.code === Codes.CYCLE_DETECTED;
  }

  isValidation(): boolean {
    return this.code === Codes.VALIDATION_ERROR;
  }

  isDependencyConflict(): boolean {
    return this.code === Codes.DEPENDENCY_CONFLICT;
  }

  isNotFound(): boolean {
    return this.code === Codes.TASK_NOT_FOUND;
  }

  isNetwork(): boolean {
    return this.code === Codes.NETWORK_ERROR;
  }

  /** The cycle as a closed loop, or null if this is not a cycle error. */
  cycleDetails(): CycleDetails | null {
    if (!this.isCycle()) return null;
    return this.details as CycleDetails;
  }

  /** Field-level form errors, or null. */
  validationDetails(): ValidationDetails | null {
    if (!this.isValidation()) return null;
    return this.details as ValidationDetails;
  }

  /** The tasks blocking a delete, or null. */
  dependencyConflictDetails(): DependencyConflictDetails | null {
    if (!this.isDependencyConflict()) return null;
    return this.details as DependencyConflictDetails;
  }

  unknownDependencyDetails(): UnknownDependencyDetails | null {
    if (this.code !== Codes.UNKNOWN_DEPENDENCY) return null;
    return this.details as UnknownDependencyDetails;
  }

  /**
   * Maps validation issues to a `{ field: message }` record for form display.
   *
   * Returns an empty object for non-validation errors, so a form can call this
   * unconditionally without branching.
   */
  fieldErrors(): Record<string, string> {
    const validation = this.validationDetails();
    if (!validation) return {};

    return validation.issues.reduce<Record<string, string>>((acc, issue) => {
      acc[issue.field] = issue.message;
      return acc;
    }, {});
  }
}

/**
 * Builds an ApiError from the backend envelope.
 *
 * `status` is threaded through separately because the envelope does not carry it
 * -- it is an HTTP-level fact, and the body is a domain-level one.
 */
export function fromEnvelope(body: ApiErrorBody, status: number): ApiError {
  return new ApiError(body.code, body.message, status, body.details);
}

/**
 * The fallback when the server could not be reached at all.
 *
 * A genuinely different failure from a 4xx: nothing was validated, nothing was
 * rejected, the request simply never landed. The UI must say "can't reach the
 * server" rather than implying the user did something wrong.
 *
 * Collapsing it into a generic error is how users end up retrying a valid form
 * because the app implied their input was bad.
 */
export function networkError(): ApiError {
  return new ApiError(
    Codes.NETWORK_ERROR,
    'Cannot reach the server. Is the backend running on port 4000?',
    0,
  );
}
