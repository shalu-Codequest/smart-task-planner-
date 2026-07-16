import type { Priority, Status, Task } from '../types/task.types';

/**
 * Presentation helpers for task fields.
 *
 * These live in `utils` rather than inside components because they are pure
 * functions of a value, used in several places (card, detail, plan entry).
 * Inlining the priority-colour ternary in three components is how you end up with
 * three subtly different colour schemes.
 */

/** Tailwind classes for a priority badge. */
export const PRIORITY_STYLES: Record<Priority, string> = {
  High: 'bg-red-50 text-red-700 ring-red-600/20',
  Medium: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Low: 'bg-slate-50 text-slate-600 ring-slate-500/20',
};

/** Tailwind classes for a status badge. */
export const STATUS_STYLES: Record<Status, string> = {
  'To Do': 'bg-slate-100 text-slate-700',
  'In Progress': 'bg-blue-50 text-blue-700',
  Done: 'bg-green-50 text-green-700',
};

/**
 * Returns the ids of every task that depends on the given task.
 *
 * The Task model stores dependencies backwards -- a task knows what it waits for,
 * not what waits on it. To answer "what does deleting this break?" the
 * relationship has to be inverted, exactly as the planner's `buildGraph` does.
 *
 * O(V * E), which is fine on a click but would not be in a render loop over every
 * card. That is why the card does not call it -- only the delete confirmation
 * does.
 */
export function findDependents(taskId: string, tasks: Task[]): string[] {
  return tasks
    .filter((task) => task.dependencies.includes(taskId))
    .map((task) => task.id);
}

/** Every distinct category present, sorted -- for the filter dropdown. */
export function extractCategories(tasks: Task[]): string[] {
  return [...new Set(tasks.map((task) => task.category))].sort((a, b) =>
    a.localeCompare(b),
  );
}
