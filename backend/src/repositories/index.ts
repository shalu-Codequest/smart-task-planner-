import { seedTasks } from '../data/seed.js';
import {
  InMemoryTaskRepository,
  type ITaskRepository,
} from './task.repository.js';

/**
 * Composition root for the data layer.
 *
 * The single place where the concrete repository implementation is chosen. Every
 * other module imports the `taskRepository` value but types it against the
 * `ITaskRepository` interface, so swapping the storage engine means editing this
 * one file and nothing else.
 *
 * A module-level singleton is appropriate because the store is the process state.
 * A DI container would be the right answer with multiple implementations to
 * inject or per-request scoping; at this size it would be ceremony without
 * benefit. Note that the tests do not touch this singleton -- they construct
 * their own repository.
 */
export const taskRepository: ITaskRepository = new InMemoryTaskRepository();

/**
 * Loads the seed dataset into the repository.
 *
 * Called once from `server.ts` on boot, so a reviewer opening the app sees a
 * meaningful dependency graph immediately rather than an empty screen.
 *
 * Clears first, so the operation is idempotent -- calling it twice cannot
 * produce duplicated or half-merged state. That matters for tests, which reseed
 * between specs.
 */
export function loadSeedData(
  repository: ITaskRepository = taskRepository,
): void {
  repository.clear();

  for (const task of seedTasks) {
    repository.save(task);
  }
}

export type { ITaskRepository } from './task.repository.js';
export { InMemoryTaskRepository } from './task.repository.js';
