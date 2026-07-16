import { COMPLETED_STATUSES, PRIORITY_RANK } from '../config/constants.js';
import { AppError } from '../errors/AppError.js';
import type {
  DependencyGraph,
  ExecutionPlan,
  PlanEntry,
} from '../types/plan.types.js';
import type { Task } from '../types/task.types.js';

/**
 * ============================================================================
 * Execution planner
 * ============================================================================
 *
 * Generates a deterministic execution order for a set of tasks with
 * dependencies.
 *
 *
 * 1. Why this is a graph problem
 * ------------------------------
 * Tasks are nodes. "T2 depends on T1" is a directed edge T1 -> T2, meaning "T1
 * must come before T2". A valid execution plan exists if and only if that graph
 * is acyclic: a cycle means a set of tasks each waiting on another, so none can
 * ever start. No ordering satisfies the constraints, and the correct response is
 * to refuse rather than to invent one.
 *
 * Producing an ordering where every edge points forwards is, by definition, a
 * topological sort.
 *
 *
 * 2. Edge direction
 * -----------------
 * The Task model stores dependencies on the dependent, pointing backwards:
 *
 *     T2.dependencies = ['T1']        // "I am waiting for T1"
 *
 * The algorithm needs to traverse forwards -- when T1 completes, which tasks
 * does that unblock?
 *
 *     adjacency['T1'] = ['T2']        // "finishing me unblocks T2"
 *
 * Graph construction therefore inverts the stored edges. Getting this backwards
 * reverses the plan while the code still looks correct, which makes it the
 * easiest bug in this problem to introduce and the hardest to see.
 *
 *
 * 3. Why Kahn's algorithm and not DFS
 * -----------------------------------
 * Both produce a valid order; only Kahn's produces a deterministic one chosen by
 * business rules. "Multiple tasks available at the same time" is precisely
 * Kahn's ready set -- the nodes whose in-degree has reached zero. Kahn's
 * materialises that set explicitly at every step, which makes it the natural
 * place to apply a selection rule.
 *
 * DFS buries the choice in recursion order, selecting the next task by whatever
 * order the node list happened to be iterated. Imposing business rules on that
 * means fighting the algorithm's structure.
 *
 *
 * 4. How the business rules compose with the sort
 * -----------------------------------------------
 * Kahn's supplies correctness -- no task appears before its prerequisites. The
 * comparator supplies determinism -- among the tasks legally available right
 * now, which one do we take?
 *
 * The comparator cannot produce an invalid plan; it only ever chooses from a set
 * the graph has already blessed. That separation is why the ordering rules can
 * change (add a due date, weight by category) without touching the sort.
 *
 *
 * 5. Cycle detection
 * ------------------
 * There is no separate cycle detector. If Kahn's terminates having emitted fewer
 * tasks than exist, the remainder have in-degree > 0 and no way to reach zero --
 * they are in a cycle, or blocked behind one.
 *
 *     emitted < total  <=>  a cycle exists
 *
 * A short DFS over only the unresolved nodes then recovers the actual path, so
 * the error can name the loop rather than merely assert that one exists.
 *
 *
 * 6. Complexity
 * -------------
 *     buildGraph      O(V + E)     every node once, every edge once
 *     kahnsSort       O(V^2 + E)   see the note on selectNext below
 *     findCyclePath   O(V + E)     one DFS
 *     ----------------------------------------------------------------
 *     TOTAL           O(V^2 + E) time, O(V + E) space
 *
 * The V^2 comes from linear-scanning the ready set on each of the V iterations.
 * A binary min-heap would make it O(V log V + E); see `selectNext` for why the
 * scan is preferred at this scale.
 */
export class PlannerService {
  /**
   * Generates the execution plan, or throws if no valid plan exists.
   *
   * @throws AppError CYCLE_DETECTED     -- with the offending cycle path in details
   * @throws AppError UNKNOWN_DEPENDENCY -- if a dependency references a missing task
   */
  generatePlan(allTasks: Task[]): ExecutionPlan {
    // Completed work is excluded from the plan (it is not "what to do next") but
    // still satisfies dependencies for everything downstream. A task whose only
    // prerequisite is already Done must be immediately eligible.
    //
    // This is a stated assumption, not a specified requirement -- the brief does
    // not cover it. It is documented in the README.
    const completedIds = new Set(
      allTasks.filter((task) => isCompleted(task)).map((task) => task.id),
    );

    const plannableTasks = allTasks.filter((task) => !completedIds.has(task.id));

    // An empty plan is a valid plan, not an error. An empty backlog means there
    // is nothing to do -- the correct answer is an empty list.
    if (plannableTasks.length === 0) {
      return emptyPlan([...completedIds]);
    }

    const graph = this.buildGraph(plannableTasks, completedIds);
    const sorted = this.kahnsSort(graph);

    // Fewer emitted than exist => at least one cycle. Recover the path so the
    // user is told which tasks are involved, not merely that a problem exists.
    if (sorted.length < plannableTasks.length) {
      const emittedIds = new Set(sorted.map((task) => task.id));

      const unresolvedIds = plannableTasks
        .filter((task) => !emittedIds.has(task.id))
        .map((task) => task.id);

      throw AppError.cycleDetected(this.findCyclePath(graph, unresolvedIds));
    }

    return this.buildPlan(sorted, [...completedIds]);
  }

  // ==========================================================================
  // Graph construction
  // ==========================================================================

  /**
   * Builds the forward adjacency list and in-degree map.
   *
   * This is where the inversion happens: `task.dependencies` points backwards
   * ("I wait for X"); the adjacency list points forwards ("finishing me unblocks
   * Y"). Every edge is flipped exactly once, here.
   *
   * Dependencies on completed tasks are skipped entirely -- no edge is created
   * and no in-degree is counted. A completed prerequisite is already satisfied,
   * so a task waiting only on completed work has in-degree 0 and is immediately
   * ready. Modelling it any other way would leave it permanently blocked and
   * produce a phantom cycle on an acyclic graph.
   *
   * Complexity: O(V + E) -- one pass to seed the maps, one over all edges. The
   * O(1) Map lookups are what keep this linear; with an array-backed store,
   * resolving each dependency ID would be an O(V) scan and this would degrade to
   * O(V * E).
   */
  private buildGraph(tasks: Task[], completedIds: Set<string>): DependencyGraph {
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const tasksById = new Map<string, Task>();

    // Pass 1: seed every node. Must complete before pass 2, or an edge could
    // reference a node whose entry does not exist yet. This ordering is what
    // makes the non-null assertions in pass 2 provably safe.
    for (const task of tasks) {
      adjacency.set(task.id, []);
      inDegree.set(task.id, 0);
      tasksById.set(task.id, task);
    }

    // Pass 2: invert the edges.
    for (const task of tasks) {
      for (const dependencyId of task.dependencies) {
        // Already-done prerequisite: satisfied, contributes no constraint.
        if (completedIds.has(dependencyId)) continue;

        // Defence in depth. The service layer already rejects unknown
        // dependencies at write time, so this should be unreachable. But the
        // planner is the last line before a wrong answer, and silently dropping
        // an unresolvable edge would produce a plan that looks valid while
        // ignoring a real constraint. A wrong plan is worse than no plan.
        if (!tasksById.has(dependencyId)) {
          throw AppError.unknownDependency(task.id, [dependencyId]);
        }

        adjacency.get(dependencyId)!.push(task.id);
        inDegree.set(task.id, inDegree.get(task.id)! + 1);
      }
    }

    return { adjacency, inDegree, tasksById };
  }

  // ==========================================================================
  // Kahn's algorithm
  // ==========================================================================

  /**
   * Topological sort with business-rule-driven selection.
   *
   *   1. Seed the ready set with every task of in-degree 0 (no prerequisites).
   *   2. While the ready set is non-empty:
   *        a. Select the best ready task via the comparator.
   *        b. Emit it.
   *        c. Decrement the in-degree of everything it unblocks.
   *        d. Anything that reaches 0 joins the ready set.
   *   3. If fewer tasks were emitted than exist, a cycle blocked the rest.
   *
   * Step 2a is where the business rules enter. A textbook Kahn's uses a plain
   * FIFO queue and takes whatever comes out -- a valid order, but an arbitrary
   * one. Replacing that with "the best one per the business rules" is what makes
   * the plan deterministic.
   *
   * Newly-unblocked tasks are appended to readyIds and considered by the
   * comparator on the next iteration, which is correct: a task unblocked
   * mid-step was not eligible at the start of that step.
   *
   * The in-degree map is copied rather than mutated, so the graph survives
   * intact for the cycle DFS afterwards. Sorting must not be destructive.
   */
  private kahnsSort(graph: DependencyGraph): Task[] {
    const { adjacency, inDegree, tasksById } = graph;

    const readyIds: string[] = [];

    for (const [taskId, degree] of inDegree) {
      if (degree === 0) readyIds.push(taskId);
    }

    const sorted: Task[] = [];
    const remainingDegree = new Map(inDegree);

    while (readyIds.length > 0) {
      const nextId = this.selectNext(readyIds, tasksById);
      readyIds.splice(readyIds.indexOf(nextId), 1);

      sorted.push(tasksById.get(nextId)!);

      // Emitting nextId satisfies one prerequisite for each dependent.
      for (const dependentId of adjacency.get(nextId)!) {
        const updated = remainingDegree.get(dependentId)! - 1;
        remainingDegree.set(dependentId, updated);

        // Last prerequisite satisfied -> now eligible.
        if (updated === 0) readyIds.push(dependentId);
      }
    }

    return sorted;
  }

  /**
   * Chooses the best task from the ready set.
   *
   * This is a linear scan for the minimum: O(k) where k = |ready set|. Across V
   * iterations that is O(V^2) worst case (a graph where everything is ready at
   * once -- e.g. V independent tasks).
   *
   * A binary min-heap keyed on the comparator would give O(V log V + E). The
   * linear scan is preferred here because:
   *
   *   - V is a sprint backlog: tens, maybe low hundreds. At V=200, V^2 is
   *     40,000 comparisons -- microseconds.
   *   - The scan is six obvious lines. A hand-rolled heap is ~50 lines of
   *     sift-up/sift-down that a reviewer must verify, and it obscures the part
   *     of the code that matters: the comparator.
   *   - The swap is fully localised. Only this method changes; nothing else in
   *     the class knows how the ready set is stored.
   *
   * A readability-over-asymptotics decision at a scale where asymptotics do not
   * bite. If the graph grew to tens of thousands of nodes, the heap goes here
   * and nowhere else.
   */
  private selectNext(readyIds: string[], tasksById: Map<string, Task>): string {
    let bestId = readyIds[0]!;

    for (let i = 1; i < readyIds.length; i++) {
      const candidateId = readyIds[i]!;

      if (compareTasks(tasksById.get(candidateId)!, tasksById.get(bestId)!) < 0) {
        bestId = candidateId;
      }
    }

    return bestId;
  }

  // ==========================================================================
  // Cycle path recovery
  // ==========================================================================

  /**
   * Recovers an actual cycle path from the unresolved nodes.
   *
   * Kahn's already established that a cycle exists; this establishes where, so
   * the error can read "T1 -> T2 -> T3 -> T1" rather than "a cycle was
   * detected" -- the difference between an error a user can fix and one they can
   * only be annoyed by.
   *
   * Method: iterative DFS with an explicit recursion stack, searching only the
   * unresolved nodes. Reaching a node already on the current path (grey) closes
   * a loop -- slice the path from that node's first occurrence to the end, and
   * append it again to make the loop legible.
   *
   * Iterative rather than recursive: a recursive DFS on a long dependency chain
   * would blow the call stack, whose default is roughly 10k frames. A
   * pathological chain of 20,000 tasks would crash the process rather than
   * return an error, and an unhandled RangeError is a far worse failure than a
   * slow response.
   *
   * Only one cycle is reported, even if several exist. Finding all of them is
   * Tarjan's strongly-connected-components algorithm -- a well-understood O(V+E)
   * solution, and the right answer if the product needed it. One actionable
   * cycle is enough to unblock the user, who fixes it and re-runs.
   *
   * Complexity: O(V + E) over the unresolved subgraph.
   */
  private findCyclePath(
    graph: DependencyGraph,
    unresolvedIds: string[],
  ): string[] {
    const unresolved = new Set(unresolvedIds);

    const WHITE = 0; // unvisited
    const GREY = 1; // on the current DFS path
    const BLACK = 2; // fully explored, no cycle reachable through it

    const colour = new Map<string, number>();
    for (const id of unresolved) colour.set(id, WHITE);

    for (const rootId of unresolvedIds) {
      if (colour.get(rootId) !== WHITE) continue;

      const path: string[] = [];

      // Explicit stack. `node` is the task; `edgeIndex` is how far through its
      // neighbours we have got -- this is what a recursive call frame would hold
      // implicitly, made explicit.
      const stack: Array<{ node: string; edgeIndex: number }> = [
        { node: rootId, edgeIndex: 0 },
      ];

      colour.set(rootId, GREY);
      path.push(rootId);

      while (stack.length > 0) {
        const frame = stack[stack.length - 1]!;
        const neighbours = graph.adjacency.get(frame.node) ?? [];

        if (frame.edgeIndex < neighbours.length) {
          const neighbour = neighbours[frame.edgeIndex]!;
          frame.edgeIndex++;

          // Only traverse within the unresolved subgraph -- resolved nodes are
          // provably not part of any cycle.
          if (!unresolved.has(neighbour)) continue;

          // Grey means already on the current path -- we have closed a loop.
          if (colour.get(neighbour) === GREY) {
            const loopStart = path.indexOf(neighbour);

            // Repeat the first node at the end so the cycle reads as a loop:
            // T1 -> T2 -> T3 -> T1
            return [...path.slice(loopStart), neighbour];
          }

          if (colour.get(neighbour) === WHITE) {
            colour.set(neighbour, GREY);
            path.push(neighbour);
            stack.push({ node: neighbour, edgeIndex: 0 });
          }

          // Black: fully explored already, no cycle reachable through it.
          continue;
        }

        // Neighbours exhausted -- retreat, and mark this node done.
        colour.set(frame.node, BLACK);
        path.pop();
        stack.pop();
      }
    }

    // Unreachable: this is only called once Kahn's has proved a cycle exists.
    // Throwing a bare Error rather than an AppError is deliberate -- if this ever
    // fires, the bug is in kahnsSort, not in the user's input. It becomes an
    // opaque 500 with a full server-side log, which is the right treatment for an
    // internal invariant violation.
    throw new Error(
      "Internal invariant violated: Kahn's reported a cycle but DFS found none.",
    );
  }

  // ==========================================================================
  // Plan assembly
  // ==========================================================================

  /** Wraps the sorted tasks in ordering metadata and scheduling metrics. */
  private buildPlan(sorted: Task[], excludedCompletedIds: string[]): ExecutionPlan {
    const waves = this.computeWaves(sorted);

    const entries: PlanEntry[] = sorted.map((task, index) => ({
      order: index + 1,
      wave: waves.get(task.id)!,
      task,
    }));

    const totalEffort = sorted.reduce(
      (sum, task) => sum + task.estimatedEffort,
      0,
    );

    return {
      entries,
      totalTasks: sorted.length,
      totalEffort,
      criticalPathEffort: this.computeCriticalPathEffort(sorted),
      waveCount:
        entries.length > 0 ? Math.max(...entries.map((e) => e.wave)) : 0,
      excludedCompletedIds,
    };
  }

  /**
   * Assigns each task a wave: the earliest step at which it could begin.
   *
   *     wave(task) = 1                                     if no prerequisites
   *     wave(task) = 1 + max(wave(p)) over prerequisites p  otherwise
   *
   * Tasks in the same wave are mutually independent -- every one of their
   * prerequisites is satisfied by an earlier wave, and none depends on another.
   * With N engineers, a whole wave could be worked in parallel.
   *
   * A single-pass DP over the topological order: because `sorted` is
   * topologically ordered, every prerequisite of a task is already processed by
   * the time we reach it. No second traversal, no memoisation, no recursion.
   * O(V + E).
   *
   * Waves exist to make the algorithm visible. A flat ordered list shows the
   * answer; waves show the reasoning -- they are the successive ready-sets of
   * Kahn's.
   */
  private computeWaves(sorted: Task[]): Map<string, number> {
    const wave = new Map<string, number>();

    for (const task of sorted) {
      // Only count prerequisites that are in the plan. Completed ones were
      // excluded from the graph and impose no timing constraint.
      const prerequisiteWaves = task.dependencies
        .map((id) => wave.get(id))
        .filter((w): w is number => w !== undefined);

      wave.set(
        task.id,
        prerequisiteWaves.length === 0 ? 1 : Math.max(...prerequisiteWaves) + 1,
      );
    }

    return wave;
  }

  /**
   * The critical path: the longest effort-weighted chain through the graph.
   *
   *     cost(task)    = effort(task) + max(cost(p)) over prerequisites p
   *     critical path = max over all tasks
   *
   * This is the floor on completion time given unlimited parallelism. No number
   * of engineers can beat it, because those tasks must happen strictly in
   * sequence.
   *
   * Contrast with `totalEffort` (the sum), which is completion time with one
   * engineer. The gap between the two is the value of parallelising; if they are
   * equal, the graph is a pure chain and adding people does nothing.
   *
   * Same approach as the waves: a single DP pass along the existing topological
   * order, so every prerequisite is already computed when we need it. O(V + E),
   * essentially free given we already have the sort.
   */
  private computeCriticalPathEffort(sorted: Task[]): number {
    const cost = new Map<string, number>();

    for (const task of sorted) {
      const prerequisiteCosts = task.dependencies
        .map((id) => cost.get(id))
        .filter((c): c is number => c !== undefined);

      const upstream =
        prerequisiteCosts.length === 0 ? 0 : Math.max(...prerequisiteCosts);

      cost.set(task.id, upstream + task.estimatedEffort);
    }

    return cost.size === 0 ? 0 : Math.max(...cost.values());
  }
}

// ============================================================================
// The comparator -- the business rules, isolated
// ============================================================================

/**
 * Orders two tasks that are both currently eligible.
 *
 * The rules, straight from the brief:
 *   1. Higher priority first.
 *   2. Same priority -> lower estimated effort first.
 *   3. Still tied     -> task ID, as a stable tie-breaker.
 *
 * Returns < 0 if `a` should be executed before `b`.
 *
 * Rule 3 is not optional. Without a total tie-breaker, two tasks identical in
 * priority and effort have no defined relative order, so the result would depend
 * on iteration order -- an implementation detail -- and the same input could
 * produce different plans across runs or across engines. The ID comparison is
 * arbitrary, but it is consistently arbitrary, which is the whole requirement.
 *
 * A free function rather than a method: it is a pure function of two tasks and
 * needs no instance state, so the business rules can be unit-tested in isolation
 * from the graph, without constructing a single edge.
 */
export function compareTasks(a: Task, b: Task): number {
  // Rule 1: higher priority first. Lower rank = higher priority.
  const priorityDelta = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (priorityDelta !== 0) return priorityDelta;

  // Rule 2: lower effort first -- clear the quick wins while priority is equal.
  const effortDelta = a.estimatedEffort - b.estimatedEffort;
  if (effortDelta !== 0) return effortDelta;

  // Rule 3: stable, arbitrary, total. Guarantees a single canonical plan.
  return a.id.localeCompare(b.id);
}

// --- Helpers ---------------------------------------------------------------

function isCompleted(task: Task): boolean {
  return (COMPLETED_STATUSES as readonly string[]).includes(task.status);
}

function emptyPlan(excludedCompletedIds: string[]): ExecutionPlan {
  return {
    entries: [],
    totalTasks: 0,
    totalEffort: 0,
    criticalPathEffort: 0,
    waveCount: 0,
    excludedCompletedIds,
  };
}
