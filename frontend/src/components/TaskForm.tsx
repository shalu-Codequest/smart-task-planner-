import { useState, type ReactNode } from 'react';

import { ApiError } from '../api/ApiError';
import { useTaskForm } from '../hooks/useTaskForm';
import { useTasks } from '../hooks/useTasks';
import { PRIORITIES, STATUSES, type Task } from '../types/task.types';
import DependencySelector from './DependencySelector';
import ErrorBanner from './ErrorBanner';

/**
 * Creates or edits a task through a single shared form.
 */
export default function TaskForm({
  task,
  onClose,
}: {
  /** The task being edited, or null to create a new one. */
  task: Task | null;
  onClose: () => void;
}) {
  const { tasks, createTask, updateTask } = useTasks();
  const { values, setField, fieldErrors, setFieldErrors, validate } =
    useTaskForm(task);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);

  const isEditing = task !== null;

  const handleSubmit = async () => {
    setSubmitError(null);

    // Run a local check first so simple issues are caught before the network call.
    if (!validate()) return;

    setSubmitting(true);

    try {
      const payload = {
        title: values.title.trim(),
        description: values.description.trim(),
        priority: values.priority,
        estimatedEffort: Number(values.estimatedEffort),
        category: values.category.trim(),
        dependencies: values.dependencies,
        status: values.status,
      };

      if (isEditing) {
        await updateTask(task.id, payload);
      } else {
        await createTask(payload);
      }

      // Close only on success; the rest of this block handles failures.
      onClose();
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 0);

      // Map server-side field issues back onto the form inputs.
      const serverFieldErrors = apiError.fieldErrors();

      if (Object.keys(serverFieldErrors).length > 0) {
        setFieldErrors(serverFieldErrors);
      }

      // Non-field errors are shown in the banner above the form.
      setSubmitError(apiError);

      // Keep the form open so the user can correct the values in place.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {submitError && (
        <ErrorBanner error={submitError} onDismiss={() => setSubmitError(null)} />
      )}

      <Field label="Title" error={fieldErrors.title} required>
        <input
          type="text"
          value={values.title}
          onChange={(event) => setField('title', event.target.value)}
          placeholder="Build the login API"
          autoFocus
          className={inputClass(fieldErrors.title)}
        />
      </Field>

      <Field label="Description" error={fieldErrors.description}>
        <textarea
          value={values.description}
          onChange={(event) => setField('description', event.target.value)}
          rows={2}
          placeholder="Optional context for whoever picks this up"
          className={inputClass(fieldErrors.description)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Priority" error={fieldErrors.priority} required>
          <select
            value={values.priority}
            onChange={(event) =>
              setField('priority', event.target.value as typeof values.priority)
            }
            className={inputClass(fieldErrors.priority)}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Estimated effort" error={fieldErrors.estimatedEffort} required>
          <input
            type="number"
            min="1"
            step="1"
            value={values.estimatedEffort}
            // Keep effort as a string so typing remains natural before submit.
            onChange={(event) => setField('estimatedEffort', event.target.value)}
            className={inputClass(fieldErrors.estimatedEffort)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" error={fieldErrors.category} required>
          <input
            type="text"
            value={values.category}
            onChange={(event) => setField('category', event.target.value)}
            placeholder="Backend"
            list="category-suggestions"
            className={inputClass(fieldErrors.category)}
          />

          {/* Suggest existing categories without restricting the user to them. */}
          <datalist id="category-suggestions">
            {[...new Set(tasks.map((t) => t.category))].map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </Field>

        <Field label="Status" error={fieldErrors.status} required>
          <select
            value={values.status}
            onChange={(event) =>
              setField('status', event.target.value as typeof values.status)
            }
            className={inputClass(fieldErrors.status)}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <DependencySelector
        taskId={task?.id ?? null}
        allTasks={tasks}
        selected={values.dependencies}
        onChange={(dependencies) => setField('dependencies', dependencies)}
      />

      {/* A completed task is excluded from the plan but still satisfies its dependents. */}
      {values.status === 'Done' && (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Completed tasks are excluded from the execution plan, but still count as
          satisfied dependencies for anything that depends on them.
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : isEditing ? 'Save changes' : 'Create task'}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  required = false,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      <div className="mt-1">{children}</div>

      {/* role="alert" so a screen reader announces the error when it appears,
          rather than the user discovering it only if they happen to navigate back
          to the field. */}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function inputClass(error?: string): string {
  return [
    'w-full rounded-md border px-3 py-1.5 text-sm',
    'focus:outline-none focus:ring-1',
    error
      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
      : 'border-slate-300 focus:border-slate-900 focus:ring-slate-900',
  ].join(' ');
}
