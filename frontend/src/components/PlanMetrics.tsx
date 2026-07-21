import type { ExecutionPlan } from '../types/plan.types';


 
export default function PlanMetrics({ plan }: { plan: ExecutionPlan }) {
  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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
          emphasis
        />
      </dl>

      <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
        The wave structure shows which tasks can run in parallel; the total effort
        shows the sequential cost of the full plan.
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
