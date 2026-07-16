import { AppError } from '../errors/AppError.js';
import type { ITaskRepository } from '../repositories/task.repository.js';
import type { TaskFilters } from '../types/query.types.js';
import type { Task } from '../types/task.types.js';
import type {
  CreateTaskDto,
  UpdateTaskDto,
} from '../validators/task.schema.js';

/**
 * Task business rules.
 *
 * The service validates domain semantics and keeps storage concerns out of the
 * application logic.
 */
export class TaskService {
  constructor(private readonly repository: ITaskRepository) {}

  // --- Queries ---------------------------------------------------------------

  /**
   * Returns tasks matching the supplied filters.
   *
   * Filtering is handled in the service so the repository can stay focused on
   * storage operations.
   */
  getAll(filters: TaskFilters = {}): Task[] {
    let tasks = this.repository.findAll();

    if (filters.priority) {
      tasks = tasks.filter((task) => task.priority === filters.priority);
    }

    if (filters.status) {
      tasks = tasks.filter((task) => task.status === filters.status);
    }

    if (filters.category) {
      const category = filters.category.toLowerCase();
      tasks = tasks.filter((task) => task.category.toLowerCase() === category);
    }

    if (filters.search) {
      const term = filters.search.toLowerCase();

      tasks = tasks.filter(
        (task) =>
          task.title.toLowerCase().includes(term) ||
          task.description.toLowerCase().includes(term),
      );
    }

    return tasks;
  }

  /**
   * Returns a single task or throws when it does not exist.
   */
  getById(id: string): Task {
    const task = this.repository.findById(id);

    if (!task) {
      throw AppError.taskNotFound(id);
    }

    return task;
  }

  // --- Commands --------------------------------------------------------------

  /**
   * Creates a task after validating the requested id, self-dependency, and
   * dependency references.
   */
  create(input: CreateTaskDto): Task {
    const id = input.id ?? this.generateId();

    if (this.repository.existsById(id)) {
      throw AppError.duplicateTaskId(id);
    }

    this.assertNoSelfDependency(id, input.dependencies);
    this.assertDependenciesExist(id, input.dependencies);

    const task: Task = {
      id,
      title: input.title,
      description: input.description,
      priority: input.priority,
      estimatedEffort: input.estimatedEffort,
      category: input.category,
      dependencies: input.dependencies,
      status: input.status,
    };

    return this.repository.save(task);
  }

  /**
   * Applies a partial update.
   *
   * Dependency checks run only when the payload includes dependency changes.
   */
  update(id: string, changes: UpdateTaskDto): Task {
    if (!this.repository.existsById(id)) {
      throw AppError.taskNotFound(id);
    }

    if (changes.dependencies !== undefined) {
      this.assertNoSelfDependency(id, changes.dependencies);
      this.assertDependenciesExist(id, changes.dependencies);
    }

    const updated = this.repository.update(id, changes);

    // Unreachable in practice: existence was checked above and this store is
    // synchronous, so nothing can delete the task in between. Narrowing the type
    // explicitly rather than asserting with `!` keeps the invariant honest -- if
    // the repository ever became async, this would be a real race and the code
    // would already be handling it.
    if (!updated) {
      throw AppError.taskNotFound(id);
    }

    return updated;
  }

  /**
   * Deletes a task unless other tasks depend on it.
   *
   * The service rejects the delete with the blocking task ids so the caller can
   * present a clear recovery path.
   */
  delete(id: string): void {
    if (!this.repository.existsById(id)) {
      throw AppError.taskNotFound(id);
    }

    const dependents = this.findDependents(id);

    if (dependents.length > 0) {
      throw AppError.dependencyConflict(id, dependents);
    }

    this.repository.remove(id);
  }

  // --- Semantic validation helpers -------------------------------------------

  private assertNoSelfDependency(id: string, dependencies: string[]): void {
    if (dependencies.includes(id)) {
      throw AppError.selfDependency(id);
    }
  }

  /**
   * Rejects references to tasks that do not exist.
   *
   * Collects every missing id and reports them together, so a caller fixing a
   * bad dependency list sees all the problems in one round trip.
   */
  private assertDependenciesExist(id: string, dependencies: string[]): void {
    const missing = dependencies.filter(
      (dependencyId) => !this.repository.existsById(dependencyId),
    );

    if (missing.length > 0) {
      throw AppError.unknownDependency(id, missing);
    }
  }

  private findDependents(id: string): string[] {
    return this.repository
      .findAll()
      .filter((task) => task.dependencies.includes(id))
      .map((task) => task.id);
  }

  /**
   * Generates the next sequential task id, such as T1, T2, T3.
   */
  private generateId(): string {
    const existingNumbers = this.repository
      .findAll()
      .map((task) => /^T(\d+)$/.exec(task.id))
      .filter((match): match is RegExpExecArray => match !== null)
      .map((match) => Number(match[1]));

    const next =
      existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

    return `T${next}`;
  }
}
