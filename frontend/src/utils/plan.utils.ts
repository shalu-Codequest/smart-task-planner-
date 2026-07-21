import type { ExecutionPlan, PlanEntry } from '../types/plan.types';
import type { Priority } from '../types/task.types';

/**
 * Groups plan entries by wave.
 *
 * A wave is a ready-set. Every task in wave N has all its prerequisites satisfied
 * by waves 1..N-1, and none of them depends on any other task in wave N, so they
 * are mutually independent -- with N engineers the entire wave could be worked
 * simultaneously.
 *
 * The waves are therefore the successive ready-sets of Kahn's algorithm, and
 * rendering them renders the algorithm's intermediate state. A flat numbered list
 * shows the answer; the waves show the reasoning, so a reader who has not opened
 * planner.service.ts can still see that the ordering follows from the dependency
 * structure rather than an arbitrary sort.
 *
 * The entries arrive already in topological order, so a single pass suffices --
 * O(V), no sorting required.
 */
export function groupByWave(entries: PlanEntry[]): Array<{
  wave: number;
  entries: PlanEntry[];
  parallelEffort: number;
}> {
  const byWave = new Map<number, PlanEntry[]>();

  for (const entry of entries) {
    const existing = byWave.get(entry.wave);

    if (existing) existing.push(entry);
    else byWave.set(entry.wave, [entry]);
  }

  return [...byWave.entries()]
    .sort(([a], [b]) => a - b)
    .map(([wave, waveEntries]) => ({
      wave,
      entries: waveEntries,
      // The effort of a wave is its longest task, not the sum, because the tasks
      // in it are independent and could run in parallel. Summing would imply a
      // sequential constraint that does not exist.
      parallelEffort: Math.max(
        ...waveEntries.map((e) => e.task.estimatedEffort),
      ),
    }));
}

const PRIORITY_ORDER: Record<Priority, number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

/**
 * Explains why this task was chosen ahead of the others that were ready at the
 * same moment.
 *
 * The ordering rules are only trustworthy if they are visible: T4 goes before T2
 * because they tie on priority and T4 has lower effort; T2 goes before T3 because
 * priority beats effort. Rendering that reasoning inline means the plan explains
 * itself rather than asking the reader to reconstruct it from the comparator.
 *
 * `siblings` are the other entries in the same wave -- exactly the set this task
 * was competing against in the ready-set.
 */
export function orderingRationale(
  entry: PlanEntry,
  siblings: PlanEntry[],
): string | null {
  // Alone in its wave: no competition, so no choice was made. Saying "chosen
  // because it was the only option" is noise.
  if (siblings.length <= 1) return null;

  // Only the first task in a wave was actually chosen over the others. The rest
  // were simply next in line, and claiming they beat anything would misrepresent
  // what the comparator did.
  const isFirstInWave = siblings[0]?.task.id === entry.task.id;
  if (!isFirstInWave) return null;

  const task = entry.task;
  const others = siblings.filter((s) => s.task.id !== task.id);

  const samePriority = others.filter((o) => o.task.priority === task.priority);

  const lowerPriority = others.filter(
    (o) => PRIORITY_ORDER[o.task.priority] > PRIORITY_ORDER[task.priority],
  );

  // Rule 1 won outright: it beat everything on priority alone.
  if (lowerPriority.length === others.length) {
    return `${task.priority} priority -- outranks the ${others.length} other ready ${
      others.length === 1 ? 'task' : 'tasks'
    }`;
  }

  // Rule 2 decided it: tied on priority, won on effort.
  const tiedButHigherEffort = samePriority.filter(
    (o) => o.task.estimatedEffort > task.estimatedEffort,
  );

  if (tiedButHigherEffort.length > 0) {
    return `${task.priority} priority, lowest effort (${task.estimatedEffort}) of the ${
      samePriority.length + 1
    } tied at this priority`;
  }

  // Rule 3 decided it: a total tie, broken by id.
  const totallyTied = samePriority.filter(
    (o) => o.task.estimatedEffort === task.estimatedEffort,
  );

  if (totallyTied.length > 0) {
    return 'Tied on priority and effort -- ordered by task ID';
  }

  return `${task.priority} priority`;
}


