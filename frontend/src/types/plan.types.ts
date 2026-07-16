import type { Task } from './task.types';

/**
 * Execution plan types -- mirrored from the backend.
 *
 * `wave` is the field the UI is really here for. Two tasks in the same wave have
 * no dependency between them and all their prerequisites are satisfied by earlier
 * waves -- they could be worked in parallel.
 *
 * Rendering the plan grouped by wave is what makes Kahn's algorithm visible
 * rather than merely correct -- the waves are its successive ready-sets.
 */
export interface PlanEntry {
  order: number;
  wave: number;
  task: Task;
}

export interface ExecutionPlan {
  entries: PlanEntry[];
  totalTasks: number;
  /** Sum of all effort -- completion time with one engineer. */
  totalEffort: number;
  /** Longest dependency chain -- the floor with unlimited engineers. */
  criticalPathEffort: number;
  waveCount: number;
  excludedCompletedIds: string[];
}
