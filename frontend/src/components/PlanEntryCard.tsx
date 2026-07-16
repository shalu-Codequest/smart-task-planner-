import type { PlanEntry } from '../types/plan.types';
import { PRIORITY_STYLES, STATUS_STYLES } from '../utils/task.utils';
import { Badge, RingBadge } from './Badge';

/**
 * Renders a single plan entry and its rationale.
 */
export default function PlanEntryCard({
  entry,
  rationale,
  onSelect,
}: {
  entry: PlanEntry;
  rationale: string | null;
  onSelect: (entry: PlanEntry) => void;
}) {
  const { task, order } = entry;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(entry)}
        className="flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-slate-300"
      >
        {/* Keep the sequence number visible so the user can track the plan position. */}
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium tabular-nums text-slate-600">
          {order}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs text-slate-400">{task.id}</span>

            <h4 className="truncate text-sm font-medium text-slate-900">
              {task.title}
            </h4>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <RingBadge className={PRIORITY_STYLES[task.priority]}>
              {task.priority}
            </RingBadge>

            <Badge className="bg-slate-50 text-slate-500">
              {task.estimatedEffort} pt
            </Badge>

            {task.status !== 'To Do' && (
              <Badge className={STATUS_STYLES[task.status]}>{task.status}</Badge>
            )}

            {task.dependencies.length > 0 && (
              <span className="text-[11px] text-slate-400">
                after {task.dependencies.join(', ')}
              </span>
            )}
          </div>

          {/* Show the reasoning behind the ordering when it is available. */}
          {rationale && (
            <p className="mt-1.5 text-[11px] text-slate-500">
              <span className="text-slate-400">Chosen first:</span> {rationale}
            </p>
          )}
        </div>
      </button>
    </li>
  );
}
