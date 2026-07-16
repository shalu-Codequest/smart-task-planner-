import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import CyclePanel from '../components/CyclePanel';
import ErrorBanner from '../components/ErrorBanner';
import Modal from '../components/Modal';
import PlanMetrics from '../components/PlanMetrics';
import SequenceView from '../components/SequenceView';
import TaskForm from '../components/TaskForm';
import WaveView from '../components/WaveView';
import { useTasks } from '../hooks/useTasks';
import type { PlanEntry } from '../types/plan.types';
import type { Task } from '../types/task.types';

type ViewMode = 'sequence' | 'waves';

/**
 * The execution plan.
 *
 * The three states this page has
 * ------------------------------
 *   1. A plan exists -> render it (sequence or waves).
 *
 *   2. A cycle exists -> render the cycle. Not an error state in the UI sense: it
 *      is a legitimate, correct answer to "what is the plan?", namely "there
 *      isn't one, and here is exactly why".
 *
 *   3. No tasks -> an empty plan is a valid plan, not a failure.
 *
 * Conflating (2) with a generic error toast is the common mistake. The backend
 * computes the exact cycle path precisely so this page can render it as content.
 *
 * The stale refetch
 * -----------------
 * `planStale` is set by every successful mutation, and this page refetches when it
 * sees the flag. Without that, a user edits a dependency on the task page, comes
 * here, and reads an ordering that no longer reflects reality -- which in a
 * planning tool means the tool is confidently telling them to do the wrong thing
 * next.
 */
export default function PlanPage() {
  const { tasks, plan, planLoading, planError, planStale, loadPlan, loadTasks } =
    useTasks();

  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<ViewMode>('waves');
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    // The plan renders task titles, so the tasks must be loaded even if the user
    // landed here directly rather than via the task list.
    if (tasks.length === 0) void loadTasks();
  }, [tasks.length, loadTasks]);

  useEffect(() => {
    // Refetch whenever the plan is stale. `loadPlan` is stable (useCallback with
    // empty deps in the provider), so this fires on mount and on the flag flipping
    // -- not on every render.
    if (planStale) void loadPlan();
  }, [planStale, loadPlan]);

  /**
   * Clicking a plan entry opens it for editing.
   *
   * The plan is where a user notices a problem -- "why is this last?" -- so the fix
   * should be one click away rather than requiring a trip back to the task list.
   */
  const handleSelectEntry = (entry: PlanEntry) => setEditingTask(entry.task);

  const editModal = editingTask && (
    <Modal title={`Edit ${editingTask.id}`} onClose={() => setEditingTask(null)}>
      <TaskForm task={editingTask} onClose={() => setEditingTask(null)} />
    </Modal>
  );

  // --- Loading --------------------------------------------------------------

  if (planLoading && !plan && !planError) {
    return (
      <>
        <PageHeader />

        <div className="rounded-lg border border-slate-200 bg-white py-12 text-center">
          <p className="text-sm text-slate-500">Generating execution plan...</p>
        </div>
      </>
    );
  }

  // --- A cycle: no plan exists, and we know exactly why ----------------------

  if (planError?.isCycle()) {
    return (
      <>
        <PageHeader />

        <CyclePanel error={planError} tasks={tasks} onEditTask={setEditingTask} />

        {editModal}
      </>
    );
  }

  // --- Any other failure (network, server) -----------------------------------

  if (planError) {
    return (
      <>
        <PageHeader />
        <ErrorBanner error={planError} />
      </>
    );
  }

  // --- No tasks: an empty plan is a valid plan -------------------------------

  if (!plan || plan.entries.length === 0) {
    const allDone =
      plan !== null &&
      plan.excludedCompletedIds.length > 0 &&
      plan.entries.length === 0;

    return (
      <>
        <PageHeader />

        <div className="rounded-lg border border-dashed border-slate-300 bg-white py-12 text-center">
          {allDone ? (
            <>
              <p className="text-sm font-medium text-slate-700">
                Everything is done
              </p>

              <p className="mt-1 text-xs text-slate-500">
                All {plan.excludedCompletedIds.length} tasks are complete, so there
                is nothing left to plan.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-700">
                Nothing to plan yet
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Create some tasks and their dependencies to generate an execution
                plan.
              </p>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-4 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
              >
                Go to tasks
              </button>
            </>
          )}
        </div>
      </>
    );
  }

  // --- A plan exists ---------------------------------------------------------

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Execution plan</h2>

          <p className="text-xs text-slate-500">
            Ordered so that every task&apos;s dependencies come before it. Where
            several tasks were available at once, the order is decided by priority,
            then effort, then task ID.
          </p>
        </div>

        {/* --- View toggle ---
            Both views answer real questions. Sequence: "what do I do next?"
            Waves: "what could be done in parallel?" */}
        <div
          role="group"
          aria-label="Plan view"
          className="flex shrink-0 rounded-md border border-slate-300 p-0.5"
        >
          <ToggleButton
            active={viewMode === 'waves'}
            onClick={() => setViewMode('waves')}
          >
            Waves
          </ToggleButton>

          <ToggleButton
            active={viewMode === 'sequence'}
            onClick={() => setViewMode('sequence')}
          >
            Sequence
          </ToggleButton>
        </div>
      </div>

      <PlanMetrics plan={plan} />

      {/* Excluded completed tasks, named. A user seeing four tasks in a plan when
          they have six needs to know where the other two went -- silently omitting
          them invites a bug report. */}
      {plan.excludedCompletedIds.length > 0 && (
        <p className="mb-4 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">
            {plan.excludedCompletedIds.join(', ')}
          </span>{' '}
          {plan.excludedCompletedIds.length === 1 ? 'is' : 'are'} complete and
          excluded from the plan &mdash; but still count as satisfied dependencies
          for anything downstream.
        </p>
      )}

      {viewMode === 'waves' ? (
        <WaveView plan={plan} onSelectEntry={handleSelectEntry} />
      ) : (
        <SequenceView plan={plan} onSelectEntry={handleSelectEntry} />
      )}

      {editModal}
    </>
  );
}

function PageHeader() {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-slate-900">Execution plan</h2>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
        active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}
