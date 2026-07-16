import { taskRepository } from '../repositories/index.js';
import { PlannerService } from './planner.service.js';
import { TaskService } from './task.service.js';

/**
 * Composition root for the service layer.
 *
 * The concrete repository is injected here, in one place. Controllers import
 * these singletons; tests construct their own instances with a fresh repository
 * and never touch them.
 *
 * Note that PlannerService takes no dependencies. It is a pure transformation of
 * Task[] -> ExecutionPlan: it does not reach into the repository, the caller
 * supplies the tasks. That is what makes it trivially testable -- a spec hands it
 * an array and asserts on the result, with no mocks, stubs, or fixtures.
 */
export const taskRepositoryInstance = taskRepository;
export const taskService = new TaskService(taskRepository);
export const plannerService = new PlannerService();

export { TaskService } from './task.service.js';
export { PlannerService, compareTasks } from './planner.service.js';
