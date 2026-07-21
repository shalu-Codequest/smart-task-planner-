import type { Task } from './task.types.js';

/**
 * A single entry in the execution plan.
 *
 * `order` is the 1-based position in the sequence -- the answer to "what do I
 * do next?"
 *
 * `wave` answers a different question: "what could be done in parallel?" Two
 * tasks in the same wave have no dependency relationship between them and both
 * have all their prerequisites satisfied by earlier waves. With two engineers,
 * they could take one each.
 *
 * Surfacing `wave` is what makes Kahn's algorithm legible in the UI. The ordered
 * list shows the sequence; the waves show why that sequence exists -- they are
 * the successive ready-sets of the algorithm.
 */
export interface PlanEntry {
  order: number;
  wave: number;
  task: Task;
}

/**
 * The generated execution plan.
 *
 * `totalEffort` is the sum of all effort for a single engineer working
 * sequentially. `waveCount` exposes how many rounds of parallel work the plan
 * contains.
 */
export interface ExecutionPlan {
  entries: PlanEntry[];
  totalTasks: number;
  totalEffort: number;
  waveCount: number;
  /** Tasks excluded from the plan because they are already complete. */
  excludedCompletedIds: string[];
}

/**
 * The internal graph representation. Not exposed over the API -- it exists so
 * that graph construction can be reasoned about independently of the sort.
 */
export interface DependencyGraph {
  /** taskId -> the tasks that depend on it (forward edges: prereq -> dependent). */
  adjacency: Map<string, string[]>;
  /** taskId -> how many unsatisfied prerequisites remain. */
  inDegree: Map<string, number>;
  /** taskId -> Task, for O(1) resolution during the sort. */
  tasksById: Map<string, Task>;
}
