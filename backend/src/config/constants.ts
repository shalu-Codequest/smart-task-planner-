import type { Priority } from '../types/task.types.js';

/**
 * Valid priority values, as a const tuple.
 *
 * `as const` is what makes this work: it gives Zod a non-empty tuple of string
 * literals, so `z.enum(PRIORITIES)` infers the exact union
 * 'High' | 'Medium' | 'Low' rather than widening to `string`. The domain types
 * in task.types.ts are derived from this tuple, so the runtime list and the
 * compile-time type are the same declaration and cannot drift.
 */
export const PRIORITIES = ['High', 'Medium', 'Low'] as const;
export const STATUSES = ['To Do', 'In Progress', 'Done'] as const;

/**
 * Statuses that mean "this work is finished".
 *
 * Used by the planner to decide which tasks to exclude from the execution plan
 * while still treating them as satisfied prerequisites.
 */
export const COMPLETED_STATUSES = ['Done'] as const;

/**
 * Numeric rank used to sort priorities. Lower rank = more urgent.
 *
 * This exists because `Priority` is a string union, and sorting strings
 * alphabetically would produce High < Low < Medium -- ranking Low above
 * Medium. Mapping to integers makes the ordering explicit and lets the
 * planner's comparator be a simple subtraction.
 *
 * It lives in `config/`, not in the planner, because "High outranks Medium" is
 * a fact about the business domain, not a detail of the sorting algorithm.
 */
export const PRIORITY_RANK: Readonly<Record<Priority, number>> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

/** Upper bound on estimated effort. Guards against nonsense input. */
export const MAX_ESTIMATED_EFFORT = 1000;
