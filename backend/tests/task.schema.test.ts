import { describe, expect, it } from 'vitest';

import {
  createTaskSchema,
  taskQuerySchema,
  updateTaskSchema,
} from '../src/validators/task.schema.js';

/**
 * Schema tests -- structural validation only.
 *
 * These prove the boundary does its job: types, enums, bounds, defaults, and --
 * most importantly -- the dependency dedupe, which is what stops the planner
 * reporting phantom cycles.
 */
describe('createTaskSchema', () => {
  const valid = {
    title: 'Build API',
    priority: 'High',
    estimatedEffort: 5,
    category: 'Backend',
  };

  it('accepts a minimal valid payload and applies defaults', () => {
    const parsed = createTaskSchema.parse(valid);

    expect(parsed.status).toBe('To Do');
    expect(parsed.description).toBe('');
    expect(parsed.dependencies).toEqual([]);
  });

  it('DEDUPLICATES the dependency array', () => {
    // The most important assertion in this file.
    //
    // A duplicate would increment the target's in-degree twice in Kahn's, but
    // there is only one real edge, so it decrements once. The counter never
    // reaches zero, the task vanishes from the plan, and the user gets a cycle
    // error for a graph with no cycle. Normalising here makes that unreachable.
    const parsed = createTaskSchema.parse({
      ...valid,
      dependencies: ['T1', 'T1', 'T2', 'T1'],
    });

    expect(parsed.dependencies).toEqual(['T1', 'T2']);
  });

  it('trims the title and category', () => {
    const parsed = createTaskSchema.parse({
      ...valid,
      title: '  Build API  ',
      category: '  Backend  ',
    });

    expect(parsed.title).toBe('Build API');
    expect(parsed.category).toBe('Backend');
  });

  it('rejects a blank title', () => {
    expect(createTaskSchema.safeParse({ ...valid, title: '' }).success).toBe(false);
  });

  it('rejects a whitespace-only title', () => {
    expect(createTaskSchema.safeParse({ ...valid, title: '   ' }).success).toBe(
      false,
    );
  });

  it('rejects an unknown priority', () => {
    expect(
      createTaskSchema.safeParse({ ...valid, priority: 'Urgent' }).success,
    ).toBe(false);
  });

  it('rejects a negative effort', () => {
    expect(
      createTaskSchema.safeParse({ ...valid, estimatedEffort: -3 }).success,
    ).toBe(false);
  });

  it('rejects a zero effort', () => {
    expect(
      createTaskSchema.safeParse({ ...valid, estimatedEffort: 0 }).success,
    ).toBe(false);
  });

  it('rejects an effort above the maximum', () => {
    expect(
      createTaskSchema.safeParse({ ...valid, estimatedEffort: 1001 }).success,
    ).toBe(false);
  });

  it('rejects a self-dependency when an explicit id is supplied', () => {
    expect(
      createTaskSchema.safeParse({
        ...valid,
        id: 'T7',
        dependencies: ['T7'],
      }).success,
    ).toBe(false);
  });

  it('reports every failing field at once, not just the first', () => {
    const result = createTaskSchema.safeParse({
      title: '',
      priority: 'Urgent',
      estimatedEffort: -5,
      category: '',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path.join('.')).sort();

      expect(fields).toEqual([
        'category',
        'estimatedEffort',
        'priority',
        'title',
      ]);
    }
  });
});

describe('updateTaskSchema', () => {
  it('accepts a partial payload', () => {
    expect(updateTaskSchema.safeParse({ title: 'Renamed' }).success).toBe(true);
  });

  it('rejects an attempt to change the id', () => {
    // `.strict()` means an unknown key is a 400, not silently ignored. Identity
    // is immutable -- changing an id would orphan every dependency edge pointing
    // at the old value.
    expect(updateTaskSchema.safeParse({ id: 'HACKED' }).success).toBe(false);
  });

  it('rejects an empty payload', () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
  });

  it('deduplicates dependencies on update as well as create', () => {
    const parsed = updateTaskSchema.parse({ dependencies: ['T1', 'T1'] });

    expect(parsed.dependencies).toEqual(['T1']);
  });

  it('allows clearing the dependency list', () => {
    expect(updateTaskSchema.safeParse({ dependencies: [] }).success).toBe(true);
  });
});

describe('taskQuerySchema', () => {
  it('coerces an empty search string to undefined', () => {
    // A cleared search box must behave exactly like no search at all.
    expect(taskQuerySchema.parse({ search: '' }).search).toBeUndefined();
  });

  it('trims the search term', () => {
    expect(taskQuerySchema.parse({ search: '  login  ' }).search).toBe('login');
  });

  it('IGNORES unknown query parameters rather than rejecting them', () => {
    // Deliberate asymmetry with the body (which is `.strict()`).
    //
    // A body is a structured payload the client built on purpose -- an unexpected
    // key means confusion and should be reported. A query string is a promiscuous
    // public surface: analytics params and link trackers get appended routinely,
    // through no fault of the client. Being strict there would break real requests
    // to enforce a rule that protects nothing.
    const parsed = taskQuerySchema.parse({
      search: 'api',
      utm_source: 'newsletter',
    });

    expect(parsed.search).toBe('api');
  });

  it('rejects an invalid priority filter', () => {
    expect(taskQuerySchema.safeParse({ priority: 'Urgent' }).success).toBe(false);
  });
});
