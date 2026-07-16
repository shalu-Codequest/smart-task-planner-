import type { ApiError } from '../api/ApiError';

/**
 * Renders an ApiError with the detail it carries from the backend.
 */
export default function ErrorBanner({
  error,
  onDismiss,
}: {
  error: ApiError;
  onDismiss?: () => void;
}) {
  return (
    <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-red-800">{error.message}</p>

          <ErrorDetails error={error} />
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded p-1 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
            aria-label="Dismiss error"
          >
            &#10005;
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Renders the structured details payload for the current error code.
 */
function ErrorDetails({ error }: { error: ApiError }) {
  // A blocked delete. Show which tasks need to be changed before retrying.
  const conflict = error.dependencyConflictDetails();

  if (conflict) {
    return (
      <p className="mt-1.5 text-xs text-red-700">
        Remove the dependency from{' '}
        <span className="font-mono font-medium">
          {conflict.dependentIds.join(', ')}
        </span>{' '}
        first, then delete this task.
      </p>
    );
  }

  // A cycle. Show the loop so the user can see what needs to be changed.
  const cycle = error.cycleDetails();

  if (cycle) {
    return (
      <p className="mt-1.5 font-mono text-xs text-red-700">
        {cycle.cyclePath.join(' \u2192 ')}
      </p>
    );
  }

  // A dependency that points to a missing task.
  const unknown = error.unknownDependencyDetails();

  if (unknown) {
    return (
      <p className="mt-1.5 text-xs text-red-700">
        These tasks do not exist:{' '}
        <span className="font-mono font-medium">
          {unknown.missingIds.join(', ')}
        </span>
      </p>
    );
  }

  // Field validation. Show all failures at once so the user can correct them in one pass.
  const validation = error.validationDetails();

  if (validation) {
    return (
      <ul className="mt-1.5 space-y-0.5 text-xs text-red-700">
        {validation.issues.map((issue) => (
          <li key={issue.field}>
            <span className="font-medium">{issue.field}</span>: {issue.message}
          </li>
        ))}
      </ul>
    );
  }

  // The request never reached the server, so the message should not imply the input was wrong.
  if (error.isNetwork()) {
    return (
      <p className="mt-1.5 text-xs text-red-700">
        Start the backend with <span className="font-mono">npm run dev</span> in the{' '}
        <span className="font-mono">backend/</span> directory.
      </p>
    );
  }

  return null;
}
