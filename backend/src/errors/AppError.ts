import { ErrorCode } from './error-codes.js';

/**
 * Application-level error carrying everything the HTTP layer needs to build a
 * response: a machine-readable code, a status, a human message, and optional
 * structured details.
 *
 * A class rather than plain objects: services throw these without knowing
 * anything about Express, and a single error middleware is the only place that
 * converts them into HTTP responses. That is what keeps the service layer
 * transport-agnostic and unit-testable.
 *
 * The static factories exist so that call sites read as intent
 * (`AppError.cycleDetected(path)`) rather than as construction detail, and so
 * that the status code for each failure mode is decided in exactly one place.
 * "A cycle is a 409" is written down once, in this file.
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';

    // Restores the prototype chain, which is lost when extending built-ins such
    // as Error under an ES2022 target. Without this, `instanceof AppError`
    // returns false in the error middleware and every domain error silently
    // degrades to a generic 500.
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, 400, message, details);
  }

  static taskNotFound(id: string): AppError {
    return new AppError(
      ErrorCode.TASK_NOT_FOUND,
      404,
      `Task '${id}' does not exist.`,
      { id },
    );
  }

  static duplicateTaskId(id: string): AppError {
    return new AppError(
      ErrorCode.DUPLICATE_TASK_ID,
      409,
      `A task with id '${id}' already exists.`,
      { id },
    );
  }

  static unknownDependency(taskId: string, missingIds: string[]): AppError {
    return new AppError(
      ErrorCode.UNKNOWN_DEPENDENCY,
      400,
      `Task '${taskId}' depends on task(s) that do not exist: ${missingIds.join(', ')}.`,
      { taskId, missingIds },
    );
  }

  static selfDependency(taskId: string): AppError {
    return new AppError(
      ErrorCode.SELF_DEPENDENCY,
      400,
      `Task '${taskId}' cannot depend on itself.`,
      { taskId },
    );
  }

  /**
   * @param cyclePath The cycle as a closed loop, e.g. ['T1','T2','T3','T1'].
   *                  Carrying the path rather than a bare boolean is what makes
   *                  this error actionable: the UI can render the loop and name
   *                  the exact edge to cut.
   */
  static cycleDetected(cyclePath: string[]): AppError {
    return new AppError(
      ErrorCode.CYCLE_DETECTED,
      409,
      `Circular dependency detected: ${cyclePath.join(' -> ')}. No valid execution plan exists.`,
      { cyclePath },
    );
  }

  static dependencyConflict(taskId: string, dependentIds: string[]): AppError {
    return new AppError(
      ErrorCode.DEPENDENCY_CONFLICT,
      409,
      `Cannot delete task '${taskId}' because task(s) ${dependentIds.join(', ')} depend on it.`,
      { taskId, dependentIds },
    );
  }
}
