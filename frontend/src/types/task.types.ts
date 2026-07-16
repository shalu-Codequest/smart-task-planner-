/**
 * Task domain types -- mirrored from the backend contract.
 *
 * On the duplication
 * ------------------
 * These are hand-copied from `backend/src/types/task.types.ts`. That is a real
 * cost: the two can drift, and nothing but discipline prevents it.
 *
 * The proper fixes, in order of rigour:
 *   1. Generate the client from an OpenAPI spec, so the contract becomes the
 *      source of truth rather than either codebase.
 *   2. Extract a shared workspace package (`@planner/types`) both import.
 *      Simpler, but couples the deploy of two independent artefacts.
 *
 * Neither is done here, deliberately: a monorepo workspace for six type
 * declarations is build tooling a reviewer would have to set up before they could
 * run anything. The duplication is ~30 lines and it is visible rather than hidden.
 */

export const PRIORITIES = ['High', 'Medium', 'Low'] as const;
export const STATUSES = ['To Do', 'In Progress', 'Done'] as const;

export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  estimatedEffort: number;
  category: string;
  dependencies: string[];
  status: Status;
}

/** Payload for POST /tasks. `id` optional -- server generates one if absent. */
export interface CreateTaskInput {
  id?: string;
  title: string;
  description?: string;
  priority: Priority;
  estimatedEffort: number;
  category: string;
  dependencies?: string[];
  status?: Status;
}

/** Payload for PUT /tasks/:id. Partial. `id` absent -- identity is immutable. */
export type UpdateTaskInput = Partial<Omit<Task, 'id'>>;

/** Query params for GET /tasks. */
export interface TaskFilters {
  search?: string;
  priority?: Priority;
  status?: Status;
  category?: string;
}
