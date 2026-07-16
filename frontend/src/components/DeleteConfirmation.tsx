import { useState } from 'react';

import { ApiError } from '../api/ApiError';
import { useTasks } from '../hooks/useTasks';
import type { Task } from '../types/task.types';
import { findDependents } from '../utils/task.utils';
import ErrorBanner from './ErrorBanner';

/**
 * Confirms a delete and explains why it may be blocked.
 */
export default function DeleteConfirmation({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  const { tasks, deleteTask } = useTasks();

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Compute the inverse relationship so the UI can show which tasks depend on this one.
  const dependentIds = findDependents(task.id, tasks);
  const dependents = tasks.filter((t) => dependentIds.includes(t.id));

  const isBlocked = dependents.length > 0;

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);

    try {
      await deleteTask(task.id);
      onClose();
    } catch (caught) {
      // Show the blocking ids in the banner and keep the dialog open.
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 0),
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner error={error} onDismiss={() => setError(null)} />}

      <div>
        <p className="text-sm text-slate-700">
          Delete <span className="font-medium text-slate-900">{task.title}</span>
          <span className="ml-1 font-mono text-xs text-slate-400">({task.id})</span>?
        </p>

        {/* Warn the user before the delete request is sent. */}
        {isBlocked && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-800">
              This task cannot be deleted yet.
            </p>

            <p className="mt-1 text-xs text-amber-700">
              {dependents.length === 1
                ? 'One task depends'
                : `${dependents.length} tasks depend`}{' '}
              on it. Remove the dependency from{' '}
              {dependents.length === 1 ? 'it' : 'them'} first:
            </p>

            <ul className="mt-2 space-y-1">
              {dependents.map((dependent) => (
                <li
                  key={dependent.id}
                  className="flex items-center gap-2 rounded bg-white px-2 py-1 text-xs"
                >
                  <span className="font-mono text-slate-400">{dependent.id}</span>
                  <span className="truncate text-slate-700">{dependent.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isBlocked && (
          <p className="mt-2 text-xs text-slate-500">
            Nothing depends on this task, so removing it will not affect the
            execution plan for anything else. This cannot be undone.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={deleting}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={() => void handleDelete()}
          // Disable the action when the delete is already known to fail.
          disabled={deleting || isBlocked}
          title={isBlocked ? 'Remove the dependent tasks first' : undefined}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {deleting ? 'Deleting...' : 'Delete task'}
        </button>
      </div>
    </div>
  );
}
