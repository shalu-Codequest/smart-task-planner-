import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '../src/errors/AppError.js';
import { ErrorCode } from '../src/errors/error-codes.js';
import { InMemoryTaskRepository } from '../src/repositories/task.repository.js';
import { TaskService } from '../src/services/task.service.js';
import type { CreateTaskDto } from '../src/validators/task.schema.js';

/**
 * Service tests.
 *
 * These cover the SEMANTIC rules -- the ones that need the store to answer.
 * Structural validation (enums, number bounds) is Zod's job and is tested
 * separately; there is no point re-testing it here.
 *
 * Each spec gets its OWN repository. The service takes the repository through its
 * constructor precisely so this is possible without touching the process
 * singleton.
 */

function makeInput(overrides: Partial<CreateTaskDto> = {}): CreateTaskDto {
  return {
    title: 'Setup project',
    description: 'Initialise the repository.',
    priority: 'High',
    estimatedEffort: 2,
    category: 'Infrastructure',
    dependencies: [],
    status: 'To Do',
    ...overrides,
  };
}

/** Asserts that `fn` throws an AppError carrying the expected code. */
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

describe('TaskService', () => {
  let repository: InMemoryTaskRepository;
  let service: TaskService;

  beforeEach(() => {
    repository = new InMemoryTaskRepository();
    service = new TaskService(repository);
  });

  describe('create', () => {
    it('creates a task with a client-supplied id', () => {
      const task = service.create(makeInput({ id: 'T1' }));

      expect(task.id).toBe('T1');
      expect(repository.count()).toBe(1);
    });

    it('generates a sequential id when none is supplied', () => {
      expect(service.create(makeInput()).id).toBe('T1');
      expect(service.create(makeInput()).id).toBe('T2');
      expect(service.create(makeInput()).id).toBe('T3');
    });

    it('generates an id above the highest existing number, not the count', () => {
      service.create(makeInput({ id: 'T1' }));
      service.create(makeInput({ id: 'T9' }));

      // Naively using count() + 1 would produce 'T3' and eventually collide.
      expect(service.create(makeInput()).id).toBe('T10');
    });

    it('ignores non-sequential ids when generating', () => {
      service.create(makeInput({ id: 'setup-project' }));

      expect(service.create(makeInput()).id).toBe('T1');
    });

    it('rejects a duplicate id', () => {
      service.create(makeInput({ id: 'T1' }));

      expectAppError(
        () => service.create(makeInput({ id: 'T1' })),
        ErrorCode.DUPLICATE_TASK_ID,
      );
    });

    it('rejects a self-dependency', () => {
      expectAppError(
        () => service.create(makeInput({ id: 'T1', dependencies: ['T1'] })),
        ErrorCode.SELF_DEPENDENCY,
      );
    });

    it('rejects a dependency on a task that does not exist', () => {
      expectAppError(
        () => service.create(makeInput({ id: 'T2', dependencies: ['T99'] })),
        ErrorCode.UNKNOWN_DEPENDENCY,
      );
    });

    it('reports every missing dependency at once, not just the first', () => {
      const error = expectAppError(
        () =>
          service.create(
            makeInput({ id: 'T2', dependencies: ['T97', 'T98', 'T99'] }),
          ),
        ErrorCode.UNKNOWN_DEPENDENCY,
      );

      const details = error.details as { missingIds: string[] };
      expect(details.missingIds).toEqual(['T97', 'T98', 'T99']);
    });

    it('accepts a dependency on a task that exists', () => {
      service.create(makeInput({ id: 'T1' }));

      const task = service.create(makeInput({ id: 'T2', dependencies: ['T1'] }));

      expect(task.dependencies).toEqual(['T1']);
    });

    it('permits a write that creates a cycle (deferred to plan generation)', () => {
      service.create(makeInput({ id: 'T1' }));
      service.create(makeInput({ id: 'T2', dependencies: ['T1'] }));

      // T1 -> T2 -> T1. ACCEPTED at write time BY DESIGN; the plan endpoint is
      // what refuses. See the service docblock for the rationale: rejecting every
      // cycle-creating write would make the graph impossible to edit.
      expect(() => service.update('T1', { dependencies: ['T2'] })).not.toThrow();
    });
  });

  describe('getById', () => {
    it('returns an existing task', () => {
      service.create(makeInput({ id: 'T1', title: 'Setup project' }));

      expect(service.getById('T1').title).toBe('Setup project');
    });

    it('throws TASK_NOT_FOUND for an unknown id', () => {
      expectAppError(() => service.getById('MISSING'), ErrorCode.TASK_NOT_FOUND);
    });
  });

  describe('getAll', () => {
    beforeEach(() => {
      service.create(
        makeInput({
          id: 'T1',
          title: 'Setup project',
          priority: 'High',
          category: 'Infra',
          status: 'Done',
        }),
      );
      service.create(
        makeInput({
          id: 'T2',
          title: 'Build login API',
          description: 'Auth endpoints',
          priority: 'High',
          category: 'Backend',
          status: 'To Do',
        }),
      );
      service.create(
        makeInput({
          id: 'T3',
          title: 'Dashboard UI',
          priority: 'Medium',
          category: 'Frontend',
          status: 'To Do',
        }),
      );
    });

    it('returns every task when no filter is supplied', () => {
      expect(service.getAll()).toHaveLength(3);
    });

    it('filters by priority', () => {
      expect(service.getAll({ priority: 'High' }).map((t) => t.id)).toEqual([
        'T1',
        'T2',
      ]);
    });

    it('filters by status', () => {
      expect(service.getAll({ status: 'Done' }).map((t) => t.id)).toEqual(['T1']);
    });

    it('filters by category, case-insensitively', () => {
      expect(service.getAll({ category: 'backend' }).map((t) => t.id)).toEqual([
        'T2',
      ]);
    });

    it('searches the title, case-insensitively', () => {
      expect(service.getAll({ search: 'DASHBOARD' }).map((t) => t.id)).toEqual([
        'T3',
      ]);
    });

    it('searches the description as well as the title', () => {
      expect(service.getAll({ search: 'auth' }).map((t) => t.id)).toEqual(['T2']);
    });

    it('combines filters with AND semantics', () => {
      const result = service.getAll({ priority: 'High', status: 'To Do' });

      expect(result.map((t) => t.id)).toEqual(['T2']);
    });

    it('returns an empty array when nothing matches', () => {
      expect(service.getAll({ search: 'nonexistent' })).toEqual([]);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      service.create(makeInput({ id: 'T1' }));
      service.create(makeInput({ id: 'T2', dependencies: ['T1'] }));
    });

    it('applies a partial change and leaves other fields intact', () => {
      const updated = service.update('T2', { title: 'Renamed' });

      expect(updated.title).toBe('Renamed');
      expect(updated.dependencies).toEqual(['T1']);
      expect(updated.priority).toBe('High');
    });

    it('throws TASK_NOT_FOUND for an unknown id', () => {
      expectAppError(
        () => service.update('MISSING', { title: 'X' }),
        ErrorCode.TASK_NOT_FOUND,
      );
    });

    it('rejects an update that introduces a self-dependency', () => {
      expectAppError(
        () => service.update('T2', { dependencies: ['T2'] }),
        ErrorCode.SELF_DEPENDENCY,
      );
    });

    it('rejects an update referencing a dependency that does not exist', () => {
      expectAppError(
        () => service.update('T2', { dependencies: ['T99'] }),
        ErrorCode.UNKNOWN_DEPENDENCY,
      );
    });

    it('does not validate dependencies when they are absent from the payload', () => {
      // A title-only update must not be forced to resend the dependency list.
      expect(() => service.update('T2', { title: 'Renamed' })).not.toThrow();
    });

    it('allows clearing the dependency list', () => {
      expect(service.update('T2', { dependencies: [] }).dependencies).toEqual([]);
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      service.create(makeInput({ id: 'T1' }));
      service.create(makeInput({ id: 'T2', dependencies: ['T1'] }));
      service.create(makeInput({ id: 'T3', dependencies: ['T1'] }));
    });

    it('deletes a task that nothing depends on', () => {
      service.delete('T2');

      expect(repository.existsById('T2')).toBe(false);
    });

    it('throws TASK_NOT_FOUND for an unknown id', () => {
      expectAppError(() => service.delete('MISSING'), ErrorCode.TASK_NOT_FOUND);
    });

    it('blocks deletion when other tasks depend on it', () => {
      expectAppError(() => service.delete('T1'), ErrorCode.DEPENDENCY_CONFLICT);
    });

    it('names every dependent in the error so the UI can show them', () => {
      const error = expectAppError(
        () => service.delete('T1'),
        ErrorCode.DEPENDENCY_CONFLICT,
      );

      const details = error.details as { dependentIds: string[] };
      expect(details.dependentIds).toEqual(['T2', 'T3']);
    });

    it('permits deletion once the dependents are detached', () => {
      service.update('T2', { dependencies: [] });
      service.update('T3', { dependencies: [] });

      expect(() => service.delete('T1')).not.toThrow();
      expect(repository.existsById('T1')).toBe(false);
    });
  });
});
