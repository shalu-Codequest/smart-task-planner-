import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryTaskRepository } from '../src/repositories/task.repository.js';
import type { Task } from '../src/types/task.types.js';

/**
 * Repository tests.
 *
 * These verify storage mechanics only -- that data goes in, comes out unchanged,
 * and cannot be corrupted from outside. Business rules (unknown dependencies,
 * delete-blocking, cycles) are not tested here because they do not live here.
 *
 * The defensive-copy specs are the ones that matter. They are the reason the
 * repository can guarantee it owns its data.
 */

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'T1',
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

describe('InMemoryTaskRepository', () => {
  let repository: InMemoryTaskRepository;

  beforeEach(() => {
    repository = new InMemoryTaskRepository();
  });

  describe('save and findById', () => {
    it('stores a task and retrieves it by id', () => {
      const task = makeTask();
      repository.save(task);

      expect(repository.findById('T1')).toEqual(task);
    });

    it('returns undefined for an unknown id', () => {
      expect(repository.findById('MISSING')).toBeUndefined();
    });

    it('replaces an existing task when saving with the same id', () => {
      repository.save(makeTask({ title: 'Original' }));
      repository.save(makeTask({ title: 'Replaced' }));

      expect(repository.count()).toBe(1);
      expect(repository.findById('T1')?.title).toBe('Replaced');
    });
  });

  describe('findAll', () => {
    it('returns an empty array when the store is empty', () => {
      expect(repository.findAll()).toEqual([]);
    });

    it('returns every stored task', () => {
      repository.save(makeTask({ id: 'T1' }));
      repository.save(makeTask({ id: 'T2' }));

      expect(repository.findAll().map((t) => t.id)).toEqual(['T1', 'T2']);
    });
  });

  describe('existsById', () => {
    it('reports presence and absence correctly', () => {
      repository.save(makeTask({ id: 'T1' }));

      expect(repository.existsById('T1')).toBe(true);
      expect(repository.existsById('T2')).toBe(false);
    });
  });

  describe('update', () => {
    it('applies a partial change and leaves other fields intact', () => {
      repository.save(makeTask({ title: 'Original', priority: 'High' }));

      const updated = repository.update('T1', { title: 'Renamed' });

      expect(updated?.title).toBe('Renamed');
      expect(updated?.priority).toBe('High');
      expect(updated?.estimatedEffort).toBe(2);
    });

    it('returns undefined when the task does not exist', () => {
      expect(repository.update('MISSING', { title: 'X' })).toBeUndefined();
    });

    it('ignores an attempt to change the id', () => {
      repository.save(makeTask({ id: 'T1' }));

      const updated = repository.update('T1', { id: 'HACKED' } as Partial<Task>);

      expect(updated?.id).toBe('T1');
      expect(repository.existsById('T1')).toBe(true);
      expect(repository.existsById('HACKED')).toBe(false);
    });
  });

  describe('remove', () => {
    it('deletes an existing task and reports success', () => {
      repository.save(makeTask({ id: 'T1' }));

      expect(repository.remove('T1')).toBe(true);
      expect(repository.findById('T1')).toBeUndefined();
      expect(repository.count()).toBe(0);
    });

    it('reports failure when the task does not exist', () => {
      expect(repository.remove('MISSING')).toBe(false);
    });
  });

  describe('defensive copying', () => {
    it('does not expose the stored object on read', () => {
      repository.save(makeTask({ id: 'T1', title: 'Original' }));

      const retrieved = repository.findById('T1')!;
      retrieved.title = 'Mutated externally';

      expect(repository.findById('T1')?.title).toBe('Original');
    });

    it('does not expose the stored dependencies array on read', () => {
      repository.save(makeTask({ id: 'T2', dependencies: ['T1'] }));

      const retrieved = repository.findById('T2')!;
      retrieved.dependencies.push('T9');

      expect(repository.findById('T2')?.dependencies).toEqual(['T1']);
    });

    it('does not retain a reference to the caller object on save', () => {
      const task = makeTask({ id: 'T1', dependencies: [] });
      repository.save(task);

      task.dependencies.push('T9');
      task.title = 'Mutated after save';

      expect(repository.findById('T1')?.dependencies).toEqual([]);
      expect(repository.findById('T1')?.title).toBe('Setup project');
    });

    it('does not expose stored objects through findAll', () => {
      repository.save(makeTask({ id: 'T1', title: 'Original' }));

      const all = repository.findAll();
      all[0]!.title = 'Mutated externally';

      expect(repository.findById('T1')?.title).toBe('Original');
    });
  });

  describe('clear', () => {
    it('empties the store', () => {
      repository.save(makeTask({ id: 'T1' }));
      repository.save(makeTask({ id: 'T2' }));

      repository.clear();

      expect(repository.count()).toBe(0);
      expect(repository.findAll()).toEqual([]);
    });
  });
});
