import type { Task } from '../types/task.types';

/**
 * Client-side cycle prediction for the dependency selector.
 *
 * Why this exists
 * ---------------
 * The server already refuses to generate a plan for a cyclic graph, and always
 * will -- that guarantee lives in the planner and is not negotiable. But refusing
 * at plan time means the user creates a dependency, navigates to the plan, and
 * only discovers there that they broke something, then has to work backwards to
 * find which edge caused it. Predicting it at selection time disables the option
 * up front, with a reason, so the bad state is never created.
 *
 * This does not replace the server check; it is a UX layer on top of it. The
 * client is a hint, the server is the truth. If they ever disagree, the server
 * wins and the error banner shows why -- the UI is correct either way, which is
 * what makes the duplication worthwhile rather than redundant.
 *
 * The algorithm
 * -------------
 * Adding "X depends on Y" creates a cycle if and only if X is already reachable
 * from Y by following the dependency edges forward: if Y (or anything Y
 * transitively unblocks) already leads back to X, making X wait on Y closes a
 * loop.
 *
 * So compute the set of tasks reachable forward from X -- X's dependents, their
 * dependents, and so on. Any task in that set is an illegal dependency for X, plus
 * X itself, which would be a one-node cycle.
 *
 * This is the same edge inversion the planner does in buildGraph: the model stores
 * dependencies backwards, so "what does X unblock?" requires flipping them.
 *
 * Complexity: O(V + E) -- one inversion pass, one BFS.
 */

/**
 * Returns the ids of every task that cannot be a dependency of `taskId`, because
 * selecting it would create a circular dependency.
 *
 * @param taskId The task being edited. Pass `null` when creating -- a task that
 *               does not exist yet has no dependents, so nothing is forbidden.
 * @param tasks  The full task set.
 */
export function findForbiddenDependencies(
  taskId: string | null,
  tasks: Task[],
): Set<string> {
  // A new task has no dependents yet, so no selection can close a loop.
  if (taskId === null) return new Set();

  // Invert the edges: dependents.get(X) = every task that waits on X.
  //
  // The Task model stores `dependencies` on the dependent, pointing backwards
  // ("I wait for T1"). To walk forward from X we need the opposite direction
  // ("finishing X unblocks T2"). This is exactly the planner's inversion.
  const dependents = new Map<string, string[]>();

  for (const task of tasks) {
    for (const dependencyId of task.dependencies) {
      const existing = dependents.get(dependencyId);

      if (existing) existing.push(task.id);
      else dependents.set(dependencyId, [task.id]);
    }
  }

  // BFS forward from taskId. Everything reachable is downstream of it, so making
  // taskId depend on any of them would close a loop.
  const forbidden = new Set<string>([taskId]); // itself: a one-node cycle
  const queue: string[] = [taskId];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const dependent of dependents.get(current) ?? []) {
      if (forbidden.has(dependent)) continue;

      forbidden.add(dependent);
      queue.push(dependent);
    }
  }

  return forbidden;
}

/**
 * A human-readable reason why a dependency is forbidden.
 *
 * "Would create a circular dependency" is technically correct and practically
 * useless -- it tells the user what is wrong but not why, so they cannot reason
 * about it. Naming the actual relationship ("T5 already depends on this task")
 * lets them see the loop.
 */
export function forbiddenReason(
  taskId: string,
  candidateId: string,
  tasks: Task[],
): string {
  if (taskId === candidateId) {
    return 'A task cannot depend on itself.';
  }

  const candidate = tasks.find((task) => task.id === candidateId);

  // The DIRECT case: the candidate already depends on us, so depending on it back
  // is an immediate two-node cycle.
  if (candidate?.dependencies.includes(taskId)) {
    return `${candidateId} already depends on this task -- selecting it would create a cycle.`;
  }

  // The TRANSITIVE case: the candidate is downstream of us through a chain.
  return `${candidateId} depends on this task indirectly -- selecting it would create a cycle.`;
}
