import type { ExecutionPlan } from '../types/plan.types';
import { parallelismGain } from '../utils/plan.utils';

/**
 * The plan's scheduling metrics.
 *
 * `totalEffort` and `criticalPathEffort` answer different questions -- one
 * engineer working sequentially, versus unlimited engineers bounded by the longest
 * dependency chain. See `plan.types.ts` for the full derivation.
 *
 * A planner that showed only the total would hide the most actionable fact in the
 * data: when the two numbers are equal, adding people to this sprint does nothing.
 *
 * The interpretation sentence below the figures is deliberate -- a metric a reader
 * has to interpret themselves is a metric most readers will skip.
 */
export default function PlanMetrics({ plan }: { plan: ExecutionPlan }) {
  const { saved, percentage, isSequential } = parallelismGain(plan);

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric
          label="Tasks"
          value={String(plan.totalTasks)}
          hint={
            plan.excludedCompletedIds.length > 0
              ? `${plan.excludedCompletedIds.length} completed, excluded`
              : 'All tasks in the plan'
          }
        />

        <Metric
          label="Waves"
          value={String(plan.waveCount)}
          hint="Rounds of parallel work"
        />

        <Metric
          label="Total effort"
          value={String(plan.totalEffort)}
          hint="One engineer, sequential"
        />

        <Metric
          label="Critical path"
          value={String(plan.criticalPathEffort)}
          hint="Floor with unlimited engineers"
          emphasis
        />
      </dl>

      <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
        {isSequential ? (
          <>
            This plan is a{' '}
            <strong className="text-slate-700">pure chain</strong> &mdash; every task
            depends on the one before it, so adding engineers would not finish it
            any sooner.
          </>
        ) : (
          <>
            Working the waves in parallel could save{' '}
            <strong className="text-slate-700">
              {saved} effort points ({percentage}%)
            </strong>{' '}
            versus working sequentially &mdash; {plan.totalEffort} down to{' '}
            {plan.criticalPathEffort}.
          </>
        )}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>

      <dd
        className={`mt-0.5 text-xl font-semibold tabular-nums ${
          emphasis ? 'text-slate-900' : 'text-slate-700'
        }`}
      >
        {value}
      </dd>

      <p className="mt-0.5 text-[11px] leading-tight text-slate-400">{hint}</p>
    </div>
  );
}
