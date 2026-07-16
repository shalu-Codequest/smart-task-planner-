import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '../src/errors/AppError.js';
import { ErrorCode } from '../src/errors/error-codes.js';
import {
  compareTasks,
  PlannerService,
} from '../src/services/planner.service.js';
import type { Task } from '../src/types/task.types.js';

/**
 * Planner tests -- the core of this assignment.
 *
 * The three examples from the brief are encoded verbatim as the first three
 * suites. They are the specification: if they pass, the planner does what was
 * asked. Everything after them covers the edge cases the brief implies but does
 * not spell out.
 */

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    description: '',
    priority: 'Medium',
    estimatedEffort: 1,
    category: 'General',
    dependencies: [],
    status: 'To Do',
    ...overrides,
  };
}

/** Extracts the plan as a plain ID array -- the thing we actually assert on. */
function planIds(planner: PlannerService, tasks: Task[]): string[] {
  return planner.generatePlan(tasks).entries.map((entry) => entry.task.id);
}

function expectAppError(fn: () => unknown, code: string): AppError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return error as AppError;
  }

  throw new Error(`Expected an AppError with code ${code}, but nothing was thrown.`);
}

describe('PlannerService', () => {
  let planner: PlannerService;

  beforeEach(() => {
    planner = new PlannerService();
  });

  // ==========================================================================
  // THE THREE EXAMPLES FROM THE ASSIGNMENT BRIEF
  // ==========================================================================

  describe('Brief Example 1 -- simple dependency chain', () => {
    it('orders T1 -> T2 -> T3', () => {
      const tasks = [
        task('T1', { title: 'Setup project' }),
        task('T2', { title: 'Build API', dependencies: ['T1'] }),
        task('T3', { title: 'Build UI', dependencies: ['T2'] }),
      ];

      expect(planIds(planner, tasks)).toEqual(['T1', 'T2', 'T3']);
    });

    it('produces the same order regardless of input order', () => {
      const shuffled = [
        task('T3', { dependencies: ['T2'] }),
        task('T1'),
        task('T2', { dependencies: ['T1'] }),
      ];

      expect(planIds(planner, shuffled)).toEqual(['T1', 'T2', 'T3']);
    });
  });

  describe('Brief Example 2 -- multiple available tasks', () => {
    const tasks = [
      task('T1', { title: 'Setup project', priority: 'High', estimatedEffort: 2 }),
      task('T2', {
        title: 'Create login API',
        priority: 'High',
        estimatedEffort: 5,
        dependencies: ['T1'],
      }),
      task('T3', {
        title: 'Dashboard UI',
        priority: 'Medium',
        estimatedEffort: 3,
        dependencies: ['T1'],
      }),
      task('T4', {
        title: 'Write unit tests',
        priority: 'High',
        estimatedEffort: 2,
        dependencies: ['T1'],
      }),
    ];

    it('produces the exact plan the brief specifies: T1 -> T4 -> T2 -> T3', () => {
      expect(planIds(planner, tasks)).toEqual(['T1', 'T4', 'T2', 'T3']);
    });

    it('prefers T4 over T2 -- same priority, lower effort', () => {
      const plan = planIds(planner, tasks);

      expect(plan.indexOf('T4')).toBeLessThan(plan.indexOf('T2'));
    });

    it('prefers T2 over T3 -- higher priority beats lower effort', () => {
      // T3 has lower effort (3 < 5) but lower priority. Priority wins: rule 1 is
      // applied before rule 2. This test exists to pin that precedence.
      const plan = planIds(planner, tasks);

      expect(plan.indexOf('T2')).toBeLessThan(plan.indexOf('T3'));
    });

    it('places T2, T3 and T4 all in wave 2', () => {
      const plan = planner.generatePlan(tasks);
      const wave = (id: string) =>
        plan.entries.find((e) => e.task.id === id)!.wave;

      expect(wave('T1')).toBe(1);
      expect([wave('T2'), wave('T3'), wave('T4')]).toEqual([2, 2, 2]);
    });
  });

  describe('Brief Example 3 -- circular dependency', () => {
    const tasks = [
      task('T1', { title: 'Design UI', dependencies: ['T3'] }),
      task('T2', { title: 'Build API', dependencies: ['T1'] }),
      task('T3', { title: 'Integrate UI', dependencies: ['T2'] }),
    ];

    it('refuses to generate a plan', () => {
      expectAppError(() => planner.generatePlan(tasks), ErrorCode.CYCLE_DETECTED);
    });

    it('returns 409 Conflict, not a 400', () => {
      const error = expectAppError(
        () => planner.generatePlan(tasks),
        ErrorCode.CYCLE_DETECTED,
      );

      expect(error.statusCode).toBe(409);
    });

    it('reports the actual cycle path, not just that a cycle exists', () => {
      const error = expectAppError(
        () => planner.generatePlan(tasks),
        ErrorCode.CYCLE_DETECTED,
      );
      const { cyclePath } = error.details as { cyclePath: string[] };

      // A closed loop: first and last element are the same node.
      expect(cyclePath[0]).toBe(cyclePath[cyclePath.length - 1]);
      // All three tasks are implicated.
      expect(new Set(cyclePath)).toEqual(new Set(['T1', 'T2', 'T3']));
    });

    it('names the involved tasks in the human-readable message', () => {
      const error = expectAppError(
        () => planner.generatePlan(tasks),
        ErrorCode.CYCLE_DETECTED,
      );

      expect(error.message).toContain('->');
      expect(error.message).toContain('T1');
    });
  });

  // ==========================================================================
  // COMPARATOR -- the business rules in isolation
  // ==========================================================================

  describe('compareTasks', () => {
    it('ranks High above Medium above Low', () => {
      expect(
        compareTasks(
          task('A', { priority: 'High' }),
          task('B', { priority: 'Medium' }),
        ),
      ).toBeLessThan(0);

      expect(
        compareTasks(
          task('A', { priority: 'Medium' }),
          task('B', { priority: 'Low' }),
        ),
      ).toBeLessThan(0);

      expect(
        compareTasks(
          task('A', { priority: 'High' }),
          task('B', { priority: 'Low' }),
        ),
      ).toBeLessThan(0);
    });

    it('does NOT rank priorities alphabetically', () => {
      // Lexicographically 'Low' < 'Medium', which would put Low first. It must
      // not. This test pins the entire reason PRIORITY_RANK exists.
      expect(
        compareTasks(
          task('A', { priority: 'Low' }),
          task('B', { priority: 'Medium' }),
        ),
      ).toBeGreaterThan(0);
    });

    it('prefers lower effort when priority is equal', () => {
      expect(
        compareTasks(
          task('A', { priority: 'High', estimatedEffort: 2 }),
          task('B', { priority: 'High', estimatedEffort: 5 }),
        ),
      ).toBeLessThan(0);
    });

    it('applies priority BEFORE effort', () => {
      // Low priority + tiny effort must still lose to High priority + big effort.
      expect(
        compareTasks(
          task('A', { priority: 'Low', estimatedEffort: 1 }),
          task('B', { priority: 'High', estimatedEffort: 99 }),
        ),
      ).toBeGreaterThan(0);
    });

    it('falls back to task id when priority and effort both tie', () => {
      const a = task('T1', { priority: 'High', estimatedEffort: 3 });
      const b = task('T2', { priority: 'High', estimatedEffort: 3 });

      expect(compareTasks(a, b)).toBeLessThan(0);
    });

    it('is antisymmetric', () => {
      const a = task('T1', { priority: 'High', estimatedEffort: 2 });
      const b = task('T2', { priority: 'Medium', estimatedEffort: 1 });

      expect(Math.sign(compareTasks(a, b))).toBe(-Math.sign(compareTasks(b, a)));
    });
  });

  // ==========================================================================
  // DETERMINISM
  // ==========================================================================

  describe('determinism', () => {
    it('produces an identical plan on repeated runs', () => {
      const tasks = [
        task('T1', { priority: 'High', estimatedEffort: 2 }),
        task('T2', {
          priority: 'High',
          estimatedEffort: 2,
          dependencies: ['T1'],
        }),
        task('T3', {
          priority: 'High',
          estimatedEffort: 2,
          dependencies: ['T1'],
        }),
        task('T4', {
          priority: 'Medium',
          estimatedEffort: 1,
          dependencies: ['T1'],
        }),
      ];

      const first = planIds(planner, tasks);

      for (let run = 0; run < 20; run++) {
        expect(planIds(planner, tasks)).toEqual(first);
      }
    });

    it('is invariant to input array order', () => {
      const base = [
        task('T1', { priority: 'High' }),
        task('T2', { priority: 'High', dependencies: ['T1'] }),
        task('T3', { priority: 'Low', dependencies: ['T1'] }),
        task('T4', { priority: 'High', dependencies: ['T1'] }),
      ];

      const expected = planIds(planner, base);

      expect(planIds(planner, [...base].reverse())).toEqual(expected);
      expect(
        planIds(planner, [base[2]!, base[0]!, base[3]!, base[1]!]),
      ).toEqual(expected);
    });

    it('breaks a total tie by id, consistently', () => {
      // Every task identical except the id. Only rule 3 can order these.
      const tasks = ['T3', 'T1', 'T2'].map((id) =>
        task(id, { priority: 'High', estimatedEffort: 5 }),
      );

      expect(planIds(planner, tasks)).toEqual(['T1', 'T2', 'T3']);
    });
  });

  // ==========================================================================
  // GRAPH EDGE CASES
  // ==========================================================================

  describe('edge cases', () => {
    it('returns an empty plan for no tasks -- not an error', () => {
      const plan = planner.generatePlan([]);

      expect(plan.entries).toEqual([]);
      expect(plan.totalTasks).toBe(0);
    });

    it('handles a single task with no dependencies', () => {
      expect(planIds(planner, [task('T1')])).toEqual(['T1']);
    });

    it('handles fully disconnected tasks', () => {
      const tasks = [
        task('T3', { priority: 'Low' }),
        task('T1', { priority: 'High' }),
        task('T2', { priority: 'Medium' }),
      ];

      // No edges at all -- pure comparator ordering.
      expect(planIds(planner, tasks)).toEqual(['T1', 'T2', 'T3']);
    });

    it('interleaves independent components by the comparator', () => {
      // Two separate chains. The comparator decides how they interleave.
      const tasks = [
        task('A1', { priority: 'Low', estimatedEffort: 1 }),
        task('A2', {
          priority: 'Low',
          estimatedEffort: 1,
          dependencies: ['A1'],
        }),
        task('B1', { priority: 'High', estimatedEffort: 1 }),
        task('B2', {
          priority: 'High',
          estimatedEffort: 1,
          dependencies: ['B1'],
        }),
      ];

      // Both roots ready at once -> B1 (High) first. Then A1 and B2 are ready;
      // B2 is High -> B2. Then A1, then A2.
      expect(planIds(planner, tasks)).toEqual(['B1', 'B2', 'A1', 'A2']);
    });

    it('handles a diamond dependency', () => {
      const tasks = [
        task('T1'),
        task('T2', { priority: 'High', dependencies: ['T1'] }),
        task('T3', { priority: 'Medium', dependencies: ['T1'] }),
        task('T4', { dependencies: ['T2', 'T3'] }),
      ];

      expect(planIds(planner, tasks)).toEqual(['T1', 'T2', 'T3', 'T4']);
    });

    it('places a join AFTER both of its prerequisites', () => {
      const plan = planIds(planner, [
        task('T1'),
        task('T2', { dependencies: ['T1'] }),
        task('T3', { dependencies: ['T1'] }),
        task('T4', { dependencies: ['T2', 'T3'] }),
      ]);

      expect(plan.indexOf('T4')).toBeGreaterThan(plan.indexOf('T2'));
      expect(plan.indexOf('T4')).toBeGreaterThan(plan.indexOf('T3'));
    });

    it('never places a task before any of its dependencies', () => {
      const tasks = [
        task('T1'),
        task('T2', { dependencies: ['T1'] }),
        task('T3', { dependencies: ['T1', 'T2'] }),
        task('T4', { dependencies: ['T2'] }),
        task('T5', { dependencies: ['T3', 'T4'] }),
        task('T6'),
      ];

      const plan = planIds(planner, tasks);
      const position = new Map(plan.map((id, index) => [id, index]));

      // The universal invariant. If this ever fails, the plan is simply wrong.
      for (const t of tasks) {
        for (const dependencyId of t.dependencies) {
          expect(position.get(dependencyId)!).toBeLessThan(
            position.get(t.id)!,
          );
        }
      }
    });

    it('handles a deep chain without stack overflow', () => {
      // A recursive DFS would blow the call stack here. The iterative one does
      // not. This test is the reason findCyclePath uses an explicit stack.
      const tasks: Task[] = [];

      for (let i = 1; i <= 5000; i++) {
        tasks.push(task(`T${i}`, i === 1 ? {} : { dependencies: [`T${i - 1}`] }));
      }

      const plan = planner.generatePlan(tasks);

      expect(plan.entries).toHaveLength(5000);
      expect(plan.entries[0]!.task.id).toBe('T1');
      expect(plan.waveCount).toBe(5000);
    });
  });

  // ==========================================================================
  // COMPLETED TASKS
  // ==========================================================================

  describe('completed tasks', () => {
    it('excludes Done tasks from the plan', () => {
      const tasks = [
        task('T1', { status: 'Done' }),
        task('T2', { dependencies: ['T1'] }),
      ];

      expect(planIds(planner, tasks)).toEqual(['T2']);
    });

    it('treats a Done dependency as satisfied, not as a blocker', () => {
      // T2's only prerequisite is complete, so T2 must be immediately ready.
      // Modelling it otherwise would leave T2 permanently blocked and Kahn's
      // would report a phantom cycle on an acyclic graph.
      const plan = planner.generatePlan([
        task('T1', { status: 'Done' }),
        task('T2', { dependencies: ['T1'] }),
      ]);

      expect(plan.entries[0]!.wave).toBe(1);
    });

    it('reports which tasks were excluded', () => {
      const plan = planner.generatePlan([
        task('T1', { status: 'Done' }),
        task('T2', { status: 'Done' }),
        task('T3'),
      ]);

      expect(plan.excludedCompletedIds.sort()).toEqual(['T1', 'T2']);
    });

    it('returns an empty plan when every task is Done', () => {
      const plan = planner.generatePlan([
        task('T1', { status: 'Done' }),
        task('T2', { status: 'Done' }),
      ]);

      expect(plan.entries).toEqual([]);
      expect(plan.excludedCompletedIds).toHaveLength(2);
    });

    it('does not treat In Progress as complete', () => {
      expect(planIds(planner, [task('T1', { status: 'In Progress' })])).toEqual([
        'T1',
      ]);
    });

    it('still detects a cycle among the incomplete tasks', () => {
      expectAppError(
        () =>
          planner.generatePlan([
            task('T0', { status: 'Done' }),
            task('T1', { dependencies: ['T2'] }),
            task('T2', { dependencies: ['T1'] }),
          ]),
        ErrorCode.CYCLE_DETECTED,
      );
    });
  });

  // ==========================================================================
  // CYCLE VARIANTS
  // ==========================================================================

  describe('cycle detection', () => {
    it('detects a two-node cycle', () => {
      const error = expectAppError(
        () =>
          planner.generatePlan([
            task('T1', { dependencies: ['T2'] }),
            task('T2', { dependencies: ['T1'] }),
          ]),
        ErrorCode.CYCLE_DETECTED,
      );
      const { cyclePath } = error.details as { cyclePath: string[] };

      expect(cyclePath).toHaveLength(3); // e.g. T1 -> T2 -> T1
      expect(cyclePath[0]).toBe(cyclePath[2]);
    });

    it('fails the WHOLE plan when only part of the graph is cyclic', () => {
      // T1 and T2 are perfectly plannable; T3 and T4 are a cycle.
      //
      // A partial plan would be actively misleading -- it would present a
      // "complete" list that silently omits work the user has. Refusing is the
      // honest answer. Documented as an assumption in the README.
      expectAppError(
        () =>
          planner.generatePlan([
            task('T1'),
            task('T2', { dependencies: ['T1'] }),
            task('T3', { dependencies: ['T4'] }),
            task('T4', { dependencies: ['T3'] }),
          ]),
        ErrorCode.CYCLE_DETECTED,
      );
    });

    it('reports only the cyclic tasks in the path, not the healthy ones', () => {
      const error = expectAppError(
        () =>
          planner.generatePlan([
            task('T1'),
            task('T2', { dependencies: ['T1'] }),
            task('T3', { dependencies: ['T4'] }),
            task('T4', { dependencies: ['T3'] }),
          ]),
        ErrorCode.CYCLE_DETECTED,
      );
      const { cyclePath } = error.details as { cyclePath: string[] };

      expect(new Set(cyclePath)).toEqual(new Set(['T3', 'T4']));
      expect(cyclePath).not.toContain('T1');
    });

    it('detects a cycle even when a valid root exists', () => {
      expectAppError(
        () =>
          planner.generatePlan([
            task('T1'),
            task('T2', { dependencies: ['T1', 'T4'] }),
            task('T3', { dependencies: ['T2'] }),
            task('T4', { dependencies: ['T3'] }),
          ]),
        ErrorCode.CYCLE_DETECTED,
      );
    });

    it('reports one cycle when several exist, without crashing', () => {
      const error = expectAppError(
        () =>
          planner.generatePlan([
            task('A1', { dependencies: ['A2'] }),
            task('A2', { dependencies: ['A1'] }),
            task('B1', { dependencies: ['B2'] }),
            task('B2', { dependencies: ['B1'] }),
          ]),
        ErrorCode.CYCLE_DETECTED,
      );
      const { cyclePath } = error.details as { cyclePath: string[] };

      // One actionable cycle is enough -- the user fixes it and re-runs.
      // Reporting all of them is Tarjan's SCC; noted as future work.
      expect(cyclePath.length).toBeGreaterThan(0);
      expect(cyclePath[0]).toBe(cyclePath[cyclePath.length - 1]);
    });

    it('throws UNKNOWN_DEPENDENCY, not a cycle, for a missing reference', () => {
      // Defence in depth: the service rejects this at write time, but a dangling
      // edge must never be silently dropped -- that would produce a plan that
      // ignores a real constraint while looking valid. A wrong plan is worse than
      // no plan.
      expectAppError(
        () => planner.generatePlan([task('T1', { dependencies: ['GHOST'] })]),
        ErrorCode.UNKNOWN_DEPENDENCY,
      );
    });
  });

  // ==========================================================================
  // WAVES AND METRICS
  // ==========================================================================

  describe('waves', () => {
    it('assigns wave 1 to every root', () => {
      const plan = planner.generatePlan([task('T1'), task('T2'), task('T3')]);

      expect(plan.entries.every((e) => e.wave === 1)).toBe(true);
      expect(plan.waveCount).toBe(1);
    });

    it('increments the wave along a chain', () => {
      const plan = planner.generatePlan([
        task('T1'),
        task('T2', { dependencies: ['T1'] }),
        task('T3', { dependencies: ['T2'] }),
      ]);

      expect(plan.entries.map((e) => e.wave)).toEqual([1, 2, 3]);
      expect(plan.waveCount).toBe(3);
    });

    it('takes the MAX of prerequisite waves, not the min', () => {
      // T4 depends on T2 (wave 2) and T3 (wave 3). It cannot start until the
      // latest of them is done, so wave 4 -- not wave 3.
      const plan = planner.generatePlan([
        task('T1'),
        task('T2', { dependencies: ['T1'] }),
        task('T3', { dependencies: ['T2'] }),
        task('T4', { dependencies: ['T2', 'T3'] }),
      ]);

      const wave = (id: string) =>
        plan.entries.find((e) => e.task.id === id)!.wave;

      expect(wave('T4')).toBe(4);
    });

    it('places mutually independent tasks in the same wave', () => {
      const plan = planner.generatePlan([
        task('T1'),
        task('T2', { dependencies: ['T1'] }),
        task('T3', { dependencies: ['T1'] }),
        task('T4', { dependencies: ['T1'] }),
      ]);

      const waveTwo = plan.entries
        .filter((e) => e.wave === 2)
        .map((e) => e.task.id);

      expect(waveTwo.sort()).toEqual(['T2', 'T3', 'T4']);
    });
  });

  describe('metrics', () => {
    it('sums the total effort', () => {
      const plan = planner.generatePlan([
        task('T1', { estimatedEffort: 2 }),
        task('T2', { estimatedEffort: 5, dependencies: ['T1'] }),
        task('T3', { estimatedEffort: 3, dependencies: ['T1'] }),
      ]);

      expect(plan.totalEffort).toBe(10);
    });

    it('computes the critical path as the longest weighted chain', () => {
      // T1(2) -> T2(5) = 7   |   T1(2) -> T3(3) = 5
      // Longest chain is 7, even though the total effort is 10.
      const plan = planner.generatePlan([
        task('T1', { estimatedEffort: 2 }),
        task('T2', { estimatedEffort: 5, dependencies: ['T1'] }),
        task('T3', { estimatedEffort: 3, dependencies: ['T1'] }),
      ]);

      expect(plan.criticalPathEffort).toBe(7);
    });

    it('reports the critical path as the max effort when nothing depends on anything', () => {
      // Fully parallel: with enough people, completion time is the single longest
      // task.
      const plan = planner.generatePlan([
        task('T1', { estimatedEffort: 2 }),
        task('T2', { estimatedEffort: 8 }),
        task('T3', { estimatedEffort: 3 }),
      ]);

      expect(plan.totalEffort).toBe(13);
      expect(plan.criticalPathEffort).toBe(8);
    });

    it('equates the critical path with the total effort for a pure chain', () => {
      // Nothing can be parallelised, so no number of engineers helps.
      const plan = planner.generatePlan([
        task('T1', { estimatedEffort: 2 }),
        task('T2', { estimatedEffort: 3, dependencies: ['T1'] }),
        task('T3', { estimatedEffort: 4, dependencies: ['T2'] }),
      ]);

      expect(plan.totalEffort).toBe(9);
      expect(plan.criticalPathEffort).toBe(9);
    });

    it('numbers the plan entries from 1', () => {
      const plan = planner.generatePlan([task('T1'), task('T2')]);

      expect(plan.entries.map((e) => e.order)).toEqual([1, 2]);
    });
  });
});
