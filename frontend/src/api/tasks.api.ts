import type { ExecutionPlan } from '../types/plan.types';
import type {
  CreateTaskInput,
  Task,
  TaskFilters,
  UpdateTaskInput,
} from '../types/task.types';
import client from './client';

/**
 * Typed request functions -- the app's view of the backend.
 *
 * Each is a thin, named wrapper around one endpoint. Components never build a
 * URL, never pick an HTTP verb, and never see a status code. They call
 * `createTask(input)` and get a `Task` or an `ApiError`.
 *
 * The value is not the abstraction; it is that the API surface becomes a
 * type-checked contract in one file. Rename an endpoint and exactly one place
 * changes. Add a field and the compiler finds every caller.
 */

export async function fetchTasks(filters: TaskFilters = {}): Promise<Task[]> {
  // Axios omits undefined params, so a cleared filter simply is not sent -- which
  // is exactly what the backend's query schema expects.
  const { data } = await client.get<Task[]>('/tasks', { params: filters });
  return data;
}

export async function fetchTask(id: string): Promise<Task> {
  const { data } = await client.get<Task>(`/tasks/${id}`);
  return data;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const { data } = await client.post<Task>('/tasks', input);
  return data;
}

export async function updateTask(
  id: string,
  changes: UpdateTaskInput,
): Promise<Task> {
  const { data } = await client.put<Task>(`/tasks/${id}`, changes);
  return data;
}

export async function deleteTask(id: string): Promise<void> {
  // 204 No Content. There is deliberately nothing to return -- asserting the task
  // still exists would be a lie about what the request just did.
  await client.delete(`/tasks/${id}`);
}

/**
 * Fetches the execution plan.
 *
 * Throws `ApiError` with code CYCLE_DETECTED (409) when no valid plan exists. The
 * `details.cyclePath` carries the offending loop, which is what lets the plan page
 * render "T1 -> T2 -> T3 -> T1" instead of a shrug.
 *
 * Takes no filters, by design. A dependency graph is only correct as a whole --
 * filtering it would hide prerequisites and turn blocked tasks into false roots,
 * producing a plan that is wrong rather than partial.
 */
export async function fetchPlan(): Promise<ExecutionPlan> {
  const { data } = await client.get<ExecutionPlan>('/tasks/plan');
  return data;
}
