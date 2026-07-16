import type { ApiError } from '../api/ApiError';
import type { Task } from '../types/task.types';

/**
 * Renders a cycle error as a clear, actionable explanation.
 */
export default function CyclePanel({
  error,
  tasks,
  onEditTask,
}: {
  error: ApiError;
  tasks: Task[];
  onEditTask: (task: Task) => void;
}) {
  const cycle = error.cycleDetails();

  if (!cycle) return null;

  const byId = new Map(tasks.map((task) => [task.id, task]));

  // The backend returns a closed loop; drop the repeated final node for display.
  const nodes = cycle.cyclePath.slice(0, -1);

  /**
   * Picks one concrete edge to highlight as the likely fix.
   */
  const lastNode = nodes[nodes.length - 1];
  const firstNode = nodes[0];

  const edgeSource = lastNode ? byId.get(lastNode) : undefined;
  const edgeTarget = firstNode ? byId.get(firstNode) : undefined;

  return (
    <div className="rounded-lg border border-red-200 bg-white">
      {/* --- Header --- */}
      <div className="border-b border-red-100 bg-red-50 px-5 py-4">
        <h2 className="text-sm font-semibold text-red-900">
          No execution plan exists
        </h2>

        <p className="mt-1 text-xs text-red-700">
          These {nodes.length} tasks depend on each other in a circle, so none of
          them can ever start. Every valid plan requires that a task&apos;s
          dependencies come before it &mdash; and here, that is impossible.
        </p>
      </div>

      {/* --- The loop, rendered as a loop --- */}
      <div className="p-5">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
          The circular dependency
        </h3>

        <ol className="mt-3 space-y-0">
          {nodes.map((id, index) => {
            const task = byId.get(id);
            const isLast = index === nodes.length - 1;

            return (
              <li key={id}>
                <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50/50 px-3 py-2">
                  <span className="font-mono text-xs font-medium text-red-600">
                    {id}
                  </span>

                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                    {task?.title ?? (
                      <em className="text-slate-400">Unknown task</em>
                    )}
                  </span>

                  {task && (
                    <button
                      type="button"
                      onClick={() => onEditTask(task)}
                      className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {/* Connect each node to the next to make the loop visible. */}
                <div className="flex items-center gap-2 py-1 pl-3">
                  <span className="text-red-400">&darr;</span>

                  <span className="text-[11px] text-red-500">
                    {isLast ? (
                      <>
                        <span className="font-medium">{nodes[0]}</span> depends on{' '}
                        <span className="font-medium">{id}</span> &mdash; closing the
                        loop
                      </>
                    ) : (
                      <>
                        <span className="font-medium">{nodes[index + 1]}</span>{' '}
                        depends on <span className="font-medium">{id}</span>
                      </>
                    )}
                  </span>
                </div>
              </li>
            );
          })}

          {/* Repeat the first node to close the visual loop. */}
          <li className="flex items-center gap-3 rounded-md border border-dashed border-red-300 bg-red-50/30 px-3 py-2">
            <span className="font-mono text-xs font-medium text-red-400">
              {nodes[0]}
            </span>

            <span className="text-xs italic text-red-400">
              ...back to the start
            </span>
          </li>
        </ol>

        {/* Show one concrete remediation path for the user. */}
        {edgeSource && edgeTarget && (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
            <h4 className="text-xs font-medium text-slate-700">To fix this</h4>

            <p className="mt-1 text-xs text-slate-600">
              Cut any one edge in the loop. For example, edit{' '}
              <span className="font-medium text-slate-900">{edgeTarget.title}</span>{' '}
              <span className="font-mono text-slate-400">({edgeTarget.id})</span> and
              remove{' '}
              <span className="font-medium text-slate-900">{edgeSource.title}</span>{' '}
              <span className="font-mono text-slate-400">({edgeSource.id})</span> from
              its dependencies.
            </p>

            <button
              type="button"
              onClick={() => onEditTask(edgeTarget)}
              className="mt-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700"
            >
              Edit {edgeTarget.id}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
