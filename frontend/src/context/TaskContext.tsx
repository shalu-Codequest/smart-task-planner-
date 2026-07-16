import {
  createContext,
  useCallback,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';

import { ApiError } from '../api/ApiError';
import * as api from '../api/tasks.api';
import type {
  CreateTaskInput,
  Task,
  TaskFilters,
  UpdateTaskInput,
} from '../types/task.types';
import { initialTaskState, taskReducer, type TaskState } from './task.reducer';

/**
 * The task store.
 *
 * Why Context rather than Zustand or Redux
 * ----------------------------------------
 * The state is one array, one plan, four flags. Context + useReducer covers it
 * with no dependencies and no concepts a reviewer has to look up. Redux would add
 * middleware, action creators, and a store setup for a problem that does not have
 * them.
 *
 * The known limit: Context has no selector-level subscription, so any state change
 * re-renders every consumer. At this size that is fine, and it is also the point
 * at which Zustand becomes worth it -- when components need to subscribe to slices
 * rather than the whole store.
 *
 * Why the actions both dispatch and re-throw
 * ------------------------------------------
 * `createTask` dispatches the failure to the store and re-throws it. Both, on
 * purpose:
 *
 *   - The dispatch drives global display -- the error banner shows it.
 *   - The throw allows local reaction -- the form needs to know its own submit
 *     failed so it can stay open and map field errors onto its inputs.
 *
 * If it only dispatched, a form would have to watch the error in state and guess
 * whether it belonged to its own submit or to another component's. That coupling
 * is what produces a form that closes on a validation failure and loses the user's
 * typing.
 */

interface TaskContextValue extends TaskState {
  loadTasks: (filters?: TaskFilters) => Promise<void>;
  loadPlan: () => Promise<void>;

  createTask: (input: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, changes: UpdateTaskInput) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;

  clearTasksError: () => void;
  clearPlanError: () => void;
}

export const TaskContext = createContext<TaskContextValue | null>(null);

/**
 * Normalises anything thrown into an ApiError.
 *
 * The client interceptor already converts every Axios rejection, so in practice
 * everything arriving here is an ApiError. This exists so that a genuine bug in
 * our own code -- a TypeError in a callback -- does not crash the provider or
 * produce an error object the UI cannot render.
 */
function toApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 0);
}

export function TaskProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(taskReducer, initialTaskState);

  const loadTasks = useCallback(async (filters: TaskFilters = {}) => {
    dispatch({ type: 'FETCH_TASKS_START' });

    try {
      dispatch({
        type: 'FETCH_TASKS_SUCCESS',
        tasks: await api.fetchTasks(filters),
      });
    } catch (error) {
      // Not re-thrown: a failed list fetch has no local caller that needs to
      // react. The banner is the whole response.
      dispatch({ type: 'FETCH_TASKS_FAILURE', error: toApiError(error) });
    }
  }, []);

  const loadPlan = useCallback(async () => {
    dispatch({ type: 'FETCH_PLAN_START' });

    try {
      dispatch({ type: 'FETCH_PLAN_SUCCESS', plan: await api.fetchPlan() });
    } catch (error) {
      // A CYCLE_DETECTED 409 lands here. It is not an exception in the colloquial
      // sense -- it is a legitimate, expected answer to "what is the plan?",
      // namely "there isn't one, and here is why". The plan page renders it as
      // content, not as a failure toast.
      dispatch({ type: 'FETCH_PLAN_FAILURE', error: toApiError(error) });
    }
  }, []);

  const createTask = useCallback(async (input: CreateTaskInput): Promise<Task> => {
    try {
      const task = await api.createTask(input);
      dispatch({ type: 'CREATE_TASK_SUCCESS', task });
      return task;
    } catch (error) {
      const apiError = toApiError(error);
      dispatch({ type: 'TASK_OPERATION_FAILURE', error: apiError });
      throw apiError; // The form needs this to stay open and show field errors.
    }
  }, []);

  const updateTask = useCallback(
    async (id: string, changes: UpdateTaskInput): Promise<Task> => {
      try {
        const task = await api.updateTask(id, changes);
        dispatch({ type: 'UPDATE_TASK_SUCCESS', task });
        return task;
      } catch (error) {
        const apiError = toApiError(error);
        dispatch({ type: 'TASK_OPERATION_FAILURE', error: apiError });
        throw apiError;
      }
    },
    [],
  );

  const deleteTask = useCallback(async (id: string): Promise<void> => {
    try {
      await api.deleteTask(id);
      dispatch({ type: 'DELETE_TASK_SUCCESS', id });
    } catch (error) {
      // A DEPENDENCY_CONFLICT 409 lands here, carrying the blocking task ids.
      // Re-thrown so the delete confirmation can stay open and name them.
      const apiError = toApiError(error);
      dispatch({ type: 'TASK_OPERATION_FAILURE', error: apiError });
      throw apiError;
    }
  }, []);

  const clearTasksError = useCallback(
    () => dispatch({ type: 'CLEAR_TASKS_ERROR' }),
    [],
  );

  const clearPlanError = useCallback(
    () => dispatch({ type: 'CLEAR_PLAN_ERROR' }),
    [],
  );

  /**
   * Memoised so the context value is not a new object on every render.
   *
   * The callbacks are already stable via useCallback with empty deps -- they only
   * ever close over `dispatch`, which React guarantees is stable -- so the only
   * real dependency is `state`.
   */
  const value = useMemo<TaskContextValue>(
    () => ({
      ...state,
      loadTasks,
      loadPlan,
      createTask,
      updateTask,
      deleteTask,
      clearTasksError,
      clearPlanError,
    }),
    [
      state,
      loadTasks,
      loadPlan,
      createTask,
      updateTask,
      deleteTask,
      clearTasksError,
      clearPlanError,
    ],
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}
