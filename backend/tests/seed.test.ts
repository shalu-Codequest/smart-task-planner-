import { describe, expect, it } from 'vitest';

import { seedTasks } from '../src/data/seed.js';

/**
 * Guards the seed dataset's structural integrity.
 *
 * These are cheap and they catch a real class of mistake: a typo in a dependency
 * ID would seed the app into a permanent UNKNOWN_DEPENDENCY state and the plan
 * endpoint would fail on boot -- a terrible first impression for a reviewer
 * opening the app.
 */
describe('seed data', () => {
  it('has unique task ids', () => {
    const ids = seedTasks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('references only dependencies that exist in the dataset', () => {
    const ids = new Set(seedTasks.map((t) => t.id));

    for (const task of seedTasks) {
      for (const dependencyId of task.dependencies) {
        expect(ids.has(dependencyId)).toBe(true);
      }
    }
  });

  it('contains no self-dependencies', () => {
    for (const task of seedTasks) {
      expect(task.dependencies).not.toContain(task.id);
    }
  });

  it('contains no duplicate dependencies within a task', () => {
    for (const task of seedTasks) {
      expect(new Set(task.dependencies).size).toBe(task.dependencies.length);
    }
  });

  it('exercises the interesting graph shapes', () => {
    const roots = seedTasks.filter((t) => t.dependencies.length === 0);
    const joins = seedTasks.filter((t) => t.dependencies.length > 1);

    // Multiple roots -> proves the planner handles disconnected components.
    expect(roots.length).toBeGreaterThan(1);
    // At least one join -> proves it handles a diamond / converging graph.
    expect(joins.length).toBeGreaterThan(0);
  });
});
