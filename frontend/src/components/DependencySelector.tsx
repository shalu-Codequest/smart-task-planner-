import { useMemo, useState } from 'react';

import type { Task } from '../types/task.types';
import {
  findForbiddenDependencies,
  forbiddenReason,
} from '../utils/cycle.utils';

/**
 * Lets the user pick dependencies while preventing invalid choices.
 */
export default function DependencySelector({
  taskId,
  allTasks,
  selected,
  onChange,
}: {
  /** The task being edited, or null when creating. */
  taskId: string | null;
  allTasks: Task[];
  selected: string[];
  onChange: (dependencies: string[]) => void;
}) {
  const [search, setSearch] = useState('');

  /**
   * Tasks that would create a cycle and should be disabled in the picker.
   */
  const forbidden = useMemo(
    () => findForbiddenDependencies(taskId, allTasks),
    [taskId, allTasks],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return allTasks;

    return allTasks.filter((task) =>
      `${task.title} ${task.id}`.toLowerCase().includes(term),
    );
  }, [allTasks, search]);

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((selectedId) => selectedId !== id)
        : [...selected, id],
    );
  };

  const selectedTasks = allTasks.filter((task) => selected.includes(task.id));

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="block text-xs font-medium text-slate-700">
          Dependencies
        </span>

        <span className="text-xs text-slate-400">
          {selected.length === 0
            ? 'None -- can start immediately'
            : `${selected.length} selected`}
        </span>
      </div>

      {/* Show the selected dependencies separately so they remain easy to remove. */}
      {selectedTasks.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selectedTasks.map((task) => (
            <span
              key={task.id}
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 py-0.5 pl-2 pr-1 text-xs"
            >
              <span className="font-mono text-slate-400">{task.id}</span>

              <span className="max-w-[140px] truncate text-slate-700">
                {task.title}
              </span>

              <button
                type="button"
                onClick={() => toggle(task.id)}
                aria-label={`Remove dependency on ${task.title}`}
                className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
              >
                &#10005;
              </button>
            </span>
          ))}
        </div>
      )}

      {allTasks.length === 0 ? (
        <p className="mt-1.5 rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
          No other tasks exist yet.
        </p>
      ) : (
        <div className="mt-1.5 rounded-md border border-slate-300">
          {/* Show the search box only when the list becomes long enough to need it. */}
          {allTasks.length > 5 && (
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks..."
              aria-label="Search dependencies"
              className="w-full border-b border-slate-200 px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none"
            />
          )}

          <ul className="max-h-44 overflow-y-auto">
            {filtered.map((task) => {
              const isForbidden = forbidden.has(task.id);
              const isSelected = selected.includes(task.id);

              return (
                <li key={task.id}>
                  <label
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs ${
                      isForbidden
                        ? 'cursor-not-allowed bg-slate-50'
                        : 'cursor-pointer hover:bg-slate-50'
                    }`}
                    // Show the reason directly on the disabled option for discoverability.
                    title={
                      isForbidden && taskId
                        ? forbiddenReason(taskId, task.id, allTasks)
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isForbidden}
                      onChange={() => toggle(task.id)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 disabled:opacity-40"
                    />

                    <span
                      className={`font-mono ${
                        isForbidden ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {task.id}
                    </span>

                    <span
                      className={`flex-1 truncate ${
                        isForbidden ? 'text-slate-400' : 'text-slate-700'
                      }`}
                    >
                      {task.title}
                    </span>

                    {/* Explain why the option is disabled. */}
                    {isForbidden && (
                      <span className="shrink-0 text-[10px] font-medium text-amber-600">
                        {taskId === task.id ? 'itself' : 'would cycle'}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}

            {filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-slate-400">
                No tasks match &ldquo;{search}&rdquo;
              </li>
            )}
          </ul>
        </div>
      )}

      {forbidden.size > 1 && (
        <p className="mt-1.5 text-xs text-slate-400">
          Greyed-out tasks depend on this one &mdash; selecting them would create a
          circular dependency.
        </p>
      )}
    </div>
  );
}
