import type { Task } from '../types/task.types.js';

/**
 * Persistence contract for tasks.
 *
 * The service layer depends on this interface rather than the concrete
 * in-memory implementation, which keeps storage concerns separate from business
 * rules.
 */
export interface ITaskRepository {
  findAll(): Task[];
  findById(id: string): Task | undefined;
  existsById(id: string): boolean;
  save(task: Task): Task;
  update(id: string, changes: Partial<Task>): Task | undefined;
  remove(id: string): boolean;
  count(): number;
  clear(): void;
}

/**
 * In-memory repository backed by a Map.
 *
 * The map provides fast lookups by id, and reads return copies so callers cannot
 * mutate the store accidentally.
 */
export class InMemoryTaskRepository implements ITaskRepository {
  private readonly tasks = new Map<string, Task>();

  /** Returns all tasks in insertion order. */
  findAll(): Task[] {
    return [...this.tasks.values()].map(cloneTask);
  }

  /**
   * Returns the task, or `undefined` if it does not exist.
   *
   * Deliberately returns `undefined` rather than throwing. "Not found" is a fact
   * about the data; deciding that it constitutes a 404 is a business decision,
   * and that decision belongs in the service. A repository that threw HTTP
   * errors would be coupled to the transport and unusable from a CLI or a job.
   */
  findById(id: string): Task | undefined {
    const task = this.tasks.get(id);
    return task ? cloneTask(task) : undefined;
  }

  /**
   * Existence check without the cost of cloning.
   *
   * Used heavily when validating dependency lists -- the service only needs to
   * know whether an ID resolves, not what the task contains.
   */
  existsById(id: string): boolean {
    return this.tasks.has(id);
  }

  /** Inserts or replaces a task and returns the stored value. */
  save(task: Task): Task {
    const stored = cloneTask(task);
    this.tasks.set(stored.id, stored);
    return cloneTask(stored);
  }

  /**
   * Applies a partial update. Returns the updated task, or `undefined` if the
   * task does not exist.
   *
   * The `id` after the spread overwrites any incoming `id`. Even though the
   * update schema already excludes it, the repository defends its own invariant:
   * the Map key and `task.id` must never disagree, or `findById` would return a
   * task whose ID differs from the one requested.
   */
  update(id: string, changes: Partial<Task>): Task | undefined {
    const existing = this.tasks.get(id);
    if (!existing) return undefined;

    const updated: Task = cloneTask({ ...existing, ...changes, id });
    this.tasks.set(id, updated);

    return cloneTask(updated);
  }

  /** Deletes a task and returns whether anything was removed. */
  remove(id: string): boolean {
    return this.tasks.delete(id);
  }

  count(): number {
    return this.tasks.size;
  }

  /**
   * Empties the store.
   *
   * Exists for test isolation: each spec starts from a known-empty repository.
   * It is not exposed through any HTTP route.
   */
  clear(): void {
    this.tasks.clear();
  }
}

/**
 * Produces an independent copy of a task.
 *
 * The dependency array is cloned explicitly because it is the only mutable nested
 * value on the task shape.
 */
function cloneTask(task: Task): Task {
  return { ...task, dependencies: [...task.dependencies] };
}
