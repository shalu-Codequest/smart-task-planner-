import type { Task } from '../types/task.types';
import { PRIORITY_STYLES, STATUS_STYLES } from '../utils/task.utils';
import { Badge, RingBadge } from './Badge';

/**
 * Shows task details and the tasks that depend on it.
 */
export default function TaskDetail({
  task,
  allTasks,
  onEdit,
}: {
  task: Task;
  allTasks: Task[];
  onEdit: (task: Task) => void;
}) {
  const byId = new Map(allTasks.map((t) => [t.id, t]));

  const dependencies = task.dependencies
    .map((id) => byId.get(id))
    .filter((t): t is Task => t !== undefined);

  // Compute the inverse relationship so the view can show what this task unlocks.
  const dependents = allTasks.filter((t) => t.dependencies.includes(task.id));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-xs text-slate-400">{task.id}</span>

        <h3 className="text-base font-semibold text-slate-900">{task.title}</h3>
      </div>

      {task.description && (
        <p className="mt-2 text-sm text-slate-600">{task.description}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <RingBadge className={PRIORITY_STYLES[task.priority]}>
          {task.priority}
        </RingBadge>

        <Badge className={STATUS_STYLES[task.status]}>{task.status}</Badge>

        <Badge className="bg-slate-50 text-slate-500">
          {task.estimatedEffort} pt
        </Badge>

        <Badge className="bg-slate-50 text-slate-500">{task.category}</Badge>
      </div>

      <TaskLinkList
        heading="Depends on"
        empty="No dependencies -- this task can start immediately."
        tasks={dependencies}
      />

      <TaskLinkList
        heading="Blocks"
        empty="Nothing depends on this task."
        tasks={dependents}
      />

      <button
        type="button"
        onClick={() => onEdit(task)}
        className="mt-6 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
      >
        Edit task
      </button>
    </div>
  );
}

function TaskLinkList({
  heading,
  empty,
  tasks,
}: {
  heading: string;
  empty: string;
  tasks: Task[];
}) {
  return (
    <div className="mt-5">
      <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {heading}
      </h4>

      {tasks.length === 0 ? (
        <p className="mt-1.5 text-xs text-slate-400">{empty}</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-sm"
            >
              <span className="font-mono text-xs text-slate-400">{task.id}</span>
              <span className="truncate text-slate-700">{task.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
