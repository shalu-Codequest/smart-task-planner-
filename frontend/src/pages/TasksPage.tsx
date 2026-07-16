import { useEffect, useMemo, useState } from 'react';

import DeleteConfirmation from '../components/DeleteConfirmation';
import EmptyState from '../components/EmptyState';
import ErrorBanner from '../components/ErrorBanner';
import FilterBar from '../components/FilterBar';
import Modal from '../components/Modal';
import TaskCard from '../components/TaskCard';
import TaskDetail from '../components/TaskDetail';
import TaskForm from '../components/TaskForm';
import TaskListSkeleton from '../components/TaskListSkeleton';
import { useTaskFilters } from '../hooks/useTaskFilters';
import { useTasks } from '../hooks/useTasks';
import type { Task } from '../types/task.types';
import { extractCategories } from '../utils/task.utils';

/**
 * The task list.
 *
 * The container: it owns the data connection and the view state, and composes
 * purely presentational children. TaskCard, FilterBar, and EmptyState are all pure
 * functions of their props -- they do not fetch, do not touch the context, and
 * hold no state.
 *
 * The alternative -- every card reaching into the context for its own data -- is
 * what produces a list where one card is stale and nobody can work out why.
 */

/**
 * Which dialog, if any, is open.
 *
 * A single discriminated union rather than three booleans. With separate
 * `isFormOpen` / `isDeleteOpen` / `selectedTask` flags, nothing prevents two being
 * true at once, and the resulting stacked modals are a bug found in QA rather than
 * in code review.
 *
 * Modelling it as "exactly one of these, or none" makes the invalid state
 * unrepresentable, which is cheaper than testing for it.
 */
type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; task: Task }
  | { kind: 'delete'; task: Task }
  | { kind: 'detail'; task: Task }
  | null;

export default function TasksPage() {
  const { tasks, tasksLoading, tasksError, loadTasks, clearTasksError } =
    useTasks();

  const { filters, setFilter, clearFilters, visibleTasks, isFiltering } =
    useTaskFilters(tasks);

  const [dialog, setDialog] = useState<Dialog>(null);

  useEffect(() => {
    // `loadTasks` is stable (useCallback with empty deps in the provider), so this
    // runs exactly once on mount. A non-memoised callback here would be the classic
    // React infinite-fetch loop.
    void loadTasks();
  }, [loadTasks]);

  /** Category options, derived from the tasks that exist rather than hardcoded. */
  const categories = useMemo(() => extractCategories(tasks), [tasks]);

  /**
   * Dependency titles, resolved once for the whole list.
   *
   * If each card resolved its own, every card would build its own id->task Map and
   * rendering N cards would be O(N * V). Building the lookup once here and passing
   * resolved titles down makes the render O(V + E) -- the same "index once, look up
   * many" reasoning as the planner's `tasksById` map.
   */
  const dependencyTitlesByTask = useMemo(() => {
    const byId = new Map(tasks.map((task) => [task.id, task]));

    return new Map(
      tasks.map((task) => [
        task.id,
        task.dependencies
          .map((id) => byId.get(id))
          .filter((dep): dep is Task => dep !== undefined)
          .map((dep) => ({ id: dep.id, title: dep.title })),
      ]),
    );
  }, [tasks]);

  const closeDialog = () => setDialog(null);

  const handleCreate = () => setDialog({ kind: 'create' });
  const handleEdit = (task: Task) => setDialog({ kind: 'edit', task });
  const handleDelete = (task: Task) => setDialog({ kind: 'delete', task });
  const handleView = (task: Task) => setDialog({ kind: 'detail', task });

  return (
    <div>
      {/* --- Header ------------------------------------------------------- */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Tasks</h2>

          <p className="text-xs text-slate-500">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreate}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          New task
        </button>
      </div>

      {/* --- Errors -------------------------------------------------------
          Rendered above the list, not instead of it. A failed delete should not
          blank the page -- the user needs to see both the error and the task it
          refers to, or the message has no context. */}
      {tasksError && (
        <ErrorBanner error={tasksError} onDismiss={clearTasksError} />
      )}

      {/* --- Filters ------------------------------------------------------ */}
      <FilterBar
        filters={filters}
        categories={categories}
        resultCount={visibleTasks.length}
        totalCount={tasks.length}
        isFiltering={isFiltering}
        onChange={setFilter}
        onClear={clearFilters}
      />

      {/* --- The list ----------------------------------------------------- */}
      {tasksLoading && tasks.length === 0 ? (
        // Skeleton only on the first load. A refetch with data already on screen
        // should not blank it -- replacing a populated list with grey boxes on every
        // mutation is worse than a brief moment of stale data.
        <TaskListSkeleton />
      ) : visibleTasks.length === 0 ? (
        <EmptyState
          isFiltering={isFiltering}
          onClearFilters={clearFilters}
          onCreate={handleCreate}
        />
      ) : (
        <ul className="space-y-2">
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              dependencyTitles={dependencyTitlesByTask.get(task.id) ?? []}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}

      {/* --- Dialogs ------------------------------------------------------
          The Modal primitive handles Escape, focus trap, focus restore, scroll
          lock, and the portal. Every dialog gets that behaviour for free, and none
          of them has its own idea of how closing works. */}

      {dialog?.kind === 'create' && (
        <Modal title="New task" onClose={closeDialog}>
          <TaskForm task={null} onClose={closeDialog} />
        </Modal>
      )}

      {dialog?.kind === 'edit' && (
        <Modal title={`Edit ${dialog.task.id}`} onClose={closeDialog}>
          <TaskForm task={dialog.task} onClose={closeDialog} />
        </Modal>
      )}

      {dialog?.kind === 'delete' && (
        <Modal title="Delete task" onClose={closeDialog} width="max-w-md">
          <DeleteConfirmation task={dialog.task} onClose={closeDialog} />
        </Modal>
      )}

      {dialog?.kind === 'detail' && (
        <Modal title="Task details" onClose={closeDialog}>
          <TaskDetail
            task={dialog.task}
            allTasks={tasks}
            // Edit replaces the current dialog rather than stacking one. The union
            // type is what guarantees that.
            onEdit={handleEdit}
          />
        </Modal>
      )}
    </div>
  );
}
