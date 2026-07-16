import type { ExecutionPlan, PlanEntry } from '../types/plan.types';
import { groupByWave, orderingRationale } from '../utils/plan.utils';
import PlanEntryCard from './PlanEntryCard';

/**
 * Renders the plan as a flat sequence of tasks.
 */
export default function SequenceView({
  plan,
  onSelectEntry,
}: {
  plan: ExecutionPlan;
  onSelectEntry: (entry: PlanEntry) => void;
}) {
  // The rationale depends on the surrounding wave, so grouping is still needed.
  const waves = groupByWave(plan.entries);

  const rationaleByTaskId = new Map<string, string | null>(
    waves.flatMap(({ entries }) =>
      entries.map(
        (entry) =>
          [entry.task.id, orderingRationale(entry, entries)] as [
            string,
            string | null,
          ],
      ),
    ),
  );

  return (
    <ol className="space-y-2">
      {plan.entries.map((entry, index) => {
        const previous = plan.entries[index - 1];
        const isNewWave = previous !== undefined && previous.wave !== entry.wave;

        return (
          <div key={entry.task.id}>
            {/* Mark wave boundaries so the sequence still reflects parallel steps. */}
            {isNewWave && (
              <div className="flex items-center gap-2 py-2">
                <div className="h-px flex-1 bg-slate-200" />

                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Wave {entry.wave} unblocked
                </span>

                <div className="h-px flex-1 bg-slate-200" />
              </div>
            )}

            <PlanEntryCard
              entry={entry}
              rationale={rationaleByTaskId.get(entry.task.id) ?? null}
              onSelect={onSelectEntry}
            />
          </div>
        );
      })}
    </ol>
  );
}
