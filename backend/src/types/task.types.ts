import type { PRIORITIES, STATUSES } from '../config/constants.js';

/**
 * Core domain types.
 *
 * Plain TypeScript with no framework coupling. Every other layer -- repository,
 * service, planner, controller -- speaks in these types, which is what keeps
 * the layers independent of one another.
 *
 * Priority and Status are derived from the const tuples in constants.ts rather
 * than declared separately -- see that file for why.
 */

/** Business priority of a task. Ordered High > Medium > Low. */
export type Priority = (typeof PRIORITIES)[number];

/** Workflow state of a task. */
export type Status = (typeof STATUSES)[number];

/**
 * A unit of work in a sprint.
 *
 * `dependencies` holds the IDs of tasks that must be completed before this task
 * can start. Note the direction: the edge is stored on the *dependent* task and
 * points backwards to its prerequisites. The planner inverts this into a
 * forward adjacency list.
 */
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

/**
 * Payload accepted when creating a task.
 *
 * `id` is optional: if the client supplies one we honour it (which keeps the
 * seed data and the assignment examples readable as T1, T2, T3). If omitted,
 * the service generates one.
 */
export type CreateTaskInput = Omit<Task, 'id'> & { id?: string };

/**
 * Payload accepted when updating a task.
 *
 * All fields optional (partial update). `id` is excluded entirely -- a task's
 * identity is immutable. Allowing an ID change would silently orphan every
 * dependency edge pointing at the old ID.
 */
export type UpdateTaskInput = Partial<Omit<Task, 'id'>>;
