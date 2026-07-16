import type { ExecutionPlan, PlanEntry } from '../types/plan.types';
import { groupByWave, orderingRationale } from '../utils/plan.utils';
import PlanEntryCard from './PlanEntryCard';

/**
 * Renders the execution plan grouped by wave.
 */
export default function WaveView({
  plan,
  onSelectEntry,
}: {
  plan: ExecutionPlan;
  onSelectEntry: (entry: PlanEntry) => void;
}) {
  const waves = groupByWave(plan.entries);

  return (
    <div className="space-y-5">
      {waves.map(({ wave, entries, parallelEffort }, index) => (
        <section key={wave}>
          {/* --- Wave header --- */}
          <div className="mb-2 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-xs font-semibold text-white">
                {wave}
              </span>

              <h3 className="text-sm font-semibold text-slate-900">Wave {wave}</h3>
            </div>

            <div className="h-px flex-1 bg-slate-200" />

            <span className="text-xs text-slate-400">
              {entries.length}{' '}
              {entries.length === 1 ? 'task' : 'tasks, workable in parallel'}
              {entries.length > 1 && ` \u00b7 ${parallelEffort} pt if parallelised`}
            </span>
          </div>

          {/* Provide brief context on the first waves so the grouping is easier to read. */}
          {index === 0 && (
            <p className="mb-2 text-xs text-slate-500">
              No dependencies &mdash; these can start immediately.
            </p>
          )}

          {index === 1 && (
            <p className="mb-2 text-xs text-slate-500">
              Unblocked once Wave 1 is complete. Nothing here depends on anything
              else in this wave, so all of it could be worked at once.
            </p>
          )}

          <ol className="space-y-2">
            {entries.map((entry) => (
              <PlanEntryCard
                key={entry.task.id}
                entry={entry}
                // The rationale is computed against the other entries in the same wave.
                rationale={orderingRationale(entry, entries)}
                onSelect={onSelectEntry}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
