import type { ApiError } from '../api/ApiError';
import type { ExecutionPlan } from '../types/plan.types';
import type { Task } from '../types/task.types';

/**
 * The single source of truth for task state.
 *
 * Why useReducer rather than several useState calls
 * -------------------------------------------------
 * The fields here are not independent. Fetching sets loading true and clears the
 * error. A successful create appends the task, stops loading, and marks the plan
 * stale. With separate `useState` calls those invariants live in whichever
 * component happens to remember them, and one that forgets produces a spinner
 * that never stops or a plan that is silently out of date.
 *
 * A reducer makes each transition atomic and puts them all in one file where they
 * can be read together. The argument is not "there are several fields" but "the
 * fields have to change together".
 *
 * On planStale
 * ------------
 * The plan is derived from the tasks and computed on the server. Any mutation --
 * create, update, delete -- can change the ordering, turn a valid plan into a
 * cycle, or the reverse. A stale plan in a planning tool is not cosmetic: it is
 * the tool confidently telling the user to do the wrong thing next.
 *
 * So every successful mutation sets planStale, and the plan page refetches when
 * it sees the flag. Marking rather than eagerly refetching avoids paying for a
 * plan request on a screen that is not showing one -- a user creating five tasks
 * in a row triggers one plan fetch, not five.
 */
export interface TaskState {
  tasks: Task[];
  plan: ExecutionPlan | null;

  tasksLoading: boolean;
  planLoading: boolean;

  /** Error from the last task operation. Cleared on the next attempt. */
  tasksError: ApiError | null;
  /** Error from the last plan fetch -- typically CYCLE_DETECTED. */
  planError: ApiError | null;

  /** The plan no longer reflects the tasks. Refetch before showing it. */
  planStale: boolean;
}

export const initialTaskState: TaskState = {
  tasks: [],
  plan: null,
  tasksLoading: false,
  planLoading: false,
  tasksError: null,
  planError: null,
  planStale: true, // Nothing fetched yet, so what we have (null) is stale.
};

/**
 * Actions.
 *
 * The FETCH_* / *_SUCCESS / *_FAILURE triple is deliberate rather than
 * ceremonial: each async operation has exactly three outcomes and each needs a
 * distinct state transition. Collapsing them into a single SET_STATE would put
 * the invariant logic back in the components.
 */
export type TaskAction =
  | { type: 'FETCH_TASKS_START' }
  | { type: 'FETCH_TASKS_SUCCESS'; tasks: Task[] }
  | { type: 'FETCH_TASKS_FAILURE'; error: ApiError }
  | { type: 'CREATE_TASK_SUCCESS'; task: Task }
  | { type: 'UPDATE_TASK_SUCCESS'; task: Task }
  | { type: 'DELETE_TASK_SUCCESS'; id: string }
  | { type: 'TASK_OPERATION_FAILURE'; error: ApiError }
  | { type: 'FETCH_PLAN_START' }
  | { type: 'FETCH_PLAN_SUCCESS'; plan: ExecutionPlan }
  | { type: 'FETCH_PLAN_FAILURE'; error: ApiError }
  | { type: 'CLEAR_TASKS_ERROR' }
  | { type: 'CLEAR_PLAN_ERROR' };

export function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    // --- Fetching tasks ------------------------------------------------------

    case 'FETCH_TASKS_START':
      // Clearing the error here is the point of the atomic transition: a retry
      // must not render the previous failure alongside the new spinner.
      return { ...state, tasksLoading: true, tasksError: null };

    case 'FETCH_TASKS_SUCCESS':
      return {
        ...state,
        tasks: action.tasks,
        tasksLoading: false,
        tasksError: null,
      };

    case 'FETCH_TASKS_FAILURE':
      return { ...state, tasksLoading: false, tasksError: action.error };

    // --- Mutations -----------------------------------------------------------
    //
    // Each one updates the task list from the server's response, never from the
    // local input. The server is authoritative: it generated the id, applied the
    // defaults, trimmed the strings, deduped the dependencies. Trusting the local
    // object would put a subtly different task in state than the one that
    // actually exists.
    //
    // Each one also sets planStale. That single flag is what keeps the plan honest.

    case 'CREATE_TASK_SUCCESS':
      return {
        ...state,
        tasks: [...state.tasks, action.task],
        tasksError: null,
        planStale: true,
      };

    case 'UPDATE_TASK_SUCCESS':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.task.id ? action.task : task,
        ),
        tasksError: null,
        planStale: true,
      };

    case 'DELETE_TASK_SUCCESS':
      return {
        ...state,
        tasks: state.tasks.filter((task) => task.id !== action.id),
        tasksError: null,
        planStale: true,
      };

    case 'TASK_OPERATION_FAILURE':
      // The mutation was rejected, so the task list is unchanged and the plan is
      // still valid. Deliberately does not set planStale -- a failed delete
      // changed nothing, and invalidating the plan would cause a pointless
      // refetch that returns the identical answer.
      return { ...state, tasksError: action.error };

    // --- Plan ----------------------------------------------------------------

    case 'FETCH_PLAN_START':
      return { ...state, planLoading: true, planError: null };

    case 'FETCH_PLAN_SUCCESS':
      return {
        ...state,
        plan: action.plan,
        planLoading: false,
        planError: null,
        planStale: false,
      };

    case 'FETCH_PLAN_FAILURE':
      return {
        ...state,
        // Discard the old plan. A cycle means no valid plan exists -- showing the
        // last good one next to a cycle warning would be presenting an ordering
        // the system has just declared impossible. The user might follow it.
        plan: null,
        planLoading: false,
        planError: action.error,
        // Not stale: this is the current answer, and the answer is "no plan".
        planStale: false,
      };

    // --- Error dismissal -----------------------------------------------------

    case 'CLEAR_TASKS_ERROR':
      return { ...state, tasksError: null };

    case 'CLEAR_PLAN_ERROR':
      return { ...state, planError: null };

    default: {
      // Exhaustiveness check. If a new action type is added to the union and not
      // handled above, `action` is not `never` here and this fails to compile.
      // The compiler enforces that the reducer stays complete.
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
