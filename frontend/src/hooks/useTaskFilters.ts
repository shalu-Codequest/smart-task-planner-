import { useMemo, useState } from 'react';

import type { Priority, Status, Task } from '../types/task.types';

/**
 * Client-side task filtering.
 *
 * Why client-side when the backend supports it
 * --------------------------------------------
 * The backend has `GET /tasks?search=&priority=&status=&category=`, which this
 * hook deliberately does not use.
 *
 * The entire task set is already in memory -- a sprint backlog is tens of tasks,
 * and the list page has already fetched all of them. Round-tripping to the server
 * to filter data the client is holding costs ~50ms per keystroke to compute
 * something that takes microseconds locally. It would also make every character
 * typed a network request, requiring debouncing, request cancellation, and a story
 * for out-of-order responses -- a meaningful amount of machinery to make the
 * experience worse than doing nothing.
 *
 * Why the backend filtering is still right to have
 * ------------------------------------------------
 * It is not dead code. It is the API being correct independently of any one client
 * -- a CLI, a mobile app, or a dashboard querying ten thousand tasks all need it.
 * It is also the migration path: when the dataset outgrows the client, the change
 * is `loadTasks(filters)` instead of this `useMemo`, and the server is already
 * ready. The line moves with the data size; the API should not have to.
 *
 * Why filter state is local rather than in the context
 * ----------------------------------------------------
 * Filters are ephemeral view state, not application state. Nothing outside this
 * page cares what is typed in the search box, and putting it in the global store
 * would re-render every consumer on every keystroke.
 */

export interface TaskFilterValues {
  search: string;
  priority: Priority | 'All';
  status: Status | 'All';
  category: string | 'All';
}

const EMPTY_FILTERS: TaskFilterValues = {
  search: '',
  priority: 'All',
  status: 'All',
  category: 'All',
};

export function useTaskFilters(tasks: Task[]) {
  const [filters, setFilters] = useState<TaskFilterValues>(EMPTY_FILTERS);

  /**
   * The filtered list.
   *
   * Memoised on [tasks, filters] so it only recomputes when one actually changes.
   * At this data size the computation is trivial -- the value here is the stable
   * array reference, which is what stops the whole card list re-rendering when
   * something unrelated in the context updates. That is a different reason from
   * memoising to avoid computation cost.
   */
  const visibleTasks = useMemo(() => {
    const term = filters.search.trim().toLowerCase();

    return tasks.filter((task) => {
      if (filters.priority !== 'All' && task.priority !== filters.priority) {
        return false;
      }

      if (filters.status !== 'All' && task.status !== filters.status) {
        return false;
      }

      if (filters.category !== 'All' && task.category !== filters.category) {
        return false;
      }

      if (term) {
        // Matches against the id as well as title and description, because this
        // app's whole vocabulary is ids -- the plan reads "T1 -> T4 -> T2", and a
        // user reading that will naturally type "T4" to find it. Omitting it would
        // make the most obvious search in the app fail.
        const haystack = [task.title, task.description, task.id]
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(term)) return false;
      }

      return true;
    });
  }, [tasks, filters]);

  const isFiltering = useMemo(
    () =>
      filters.search.trim() !== '' ||
      filters.priority !== 'All' ||
      filters.status !== 'All' ||
      filters.category !== 'All',
    [filters],
  );

  const setFilter = <K extends keyof TaskFilterValues>(
    key: K,
    value: TaskFilterValues[K],
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  return { filters, setFilter, clearFilters, visibleTasks, isFiltering };
}
