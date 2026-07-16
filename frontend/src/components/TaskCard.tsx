import type { ReactNode } from 'react';

import type { Task } from '../types/task.types';
import { PRIORITY_STYLES, STATUS_STYLES } from '../utils/task.utils';
import { Badge, RingBadge } from './Badge';

/**
 * One task, as a row.
 *
 * Purely presentational: it takes a task and three callbacks, does not fetch, does
 * not know the context exists, and holds no state. The card therefore renders
 * identically wherever it is put, can be tested by passing an object, and cannot
 * disagree with another card about the data. All the state lives at the page.
 *
 * `dependencyTitles` arrives already resolved. Showing "Depends on: Setup project"
 * rather than "Depends on: T1" costs one prop and is the difference between a list
 * a person can read and one they have to decode. In an app whose entire output is
 * an ordering of ids, giving those ids meaning is most of the usability work.
 */
export default function TaskCard({
  task,
  dependencyTitles,
  onView,
  onEdit,
  onDelete,
}: {
  task: Task;
  dependencyTitles: Array<{ id: string; title: string }>;
  onView: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  return (
    <li className="group rounded-lg border border-slate-200 bg-white transition-colors hover:border-slate-300">
      <div className="flex items-start gap-3 p-4">
        {/* --- Main content, clickable to open the detail view --- */}
        <button
          type="button"
          onClick={() => onView(task)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs text-slate-400">{task.id}</span>

            <h3
              className={`truncate text-sm font-medium ${
                task.status === 'Done'
                  ? 'text-slate-400 line-through'
                  : 'text-slate-900'
              }`}
            >
              {task.title}
            </h3>
          </div>

          {task.description && (
            <p className="mt-1 line-clamp-1 text-xs text-slate-500">
              {task.description}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <RingBadge className={PRIORITY_STYLES[task.priority]}>
              {task.priority}
            </RingBadge>

            <Badge className={STATUS_STYLES[task.status]}>{task.status}</Badge>

            <Badge className="bg-slate-50 text-slate-500">
              {task.estimatedEffort} pt
            </Badge>

            <Badge className="bg-slate-50 text-slate-500">{task.category}</Badge>
          </div>

          {dependencyTitles.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              <span className="text-slate-400">Depends on:</span>{' '}
              {dependencyTitles.map((dep, index) => (
                <span key={dep.id}>
                  {index > 0 && ', '}
                  <span className="font-medium text-slate-600">{dep.title}</span>
                  <span className="ml-0.5 font-mono text-slate-400">
                    ({dep.id})
                  </span>
                </span>
              ))}
            </p>
          )}
        </button>

        {/* --- Actions ---
            Visible on focus-within AS WELL AS hover, so they are reachable by
            keyboard. Hover-only actions are a common accessibility failure. */}
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <ActionButton label={`Edit ${task.title}`} onClick={() => onEdit(task)}>
            Edit
          </ActionButton>

          <ActionButton
            label={`Delete ${task.title}`}
            onClick={() => onDelete(task)}
            danger
          >
            Delete
          </ActionButton>
        </div>
      </div>
    </li>
  );
}

function ActionButton({
  children,
  label,
  onClick,
  danger = false,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
        danger
          ? 'text-slate-500 hover:bg-red-50 hover:text-red-600'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}
