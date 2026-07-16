import type { TaskFilterValues } from '../hooks/useTaskFilters';
import { PRIORITIES, STATUSES } from '../types/task.types';

/**
 * Search and filter controls.
 *
 * Fully controlled and stateless: every value comes down as a prop and every
 * change goes up through `onChange`, with the filter state living in
 * `useTaskFilters` on the page. That makes this a pure function of its props --
 * renderable anywhere, testable with no setup, and with exactly one place (the
 * hook) where the filter state can be wrong.
 *
 * The `resultCount` prop exists so the user always knows whether an empty list
 * means "no tasks" or "no matches". Conflating those is a common, disorienting UI
 * bug.
 */
export default function FilterBar({
  filters,
  categories,
  resultCount,
  totalCount,
  isFiltering,
  onChange,
  onClear,
}: {
  filters: TaskFilterValues;
  categories: string[];
  resultCount: number;
  totalCount: number;
  isFiltering: boolean;
  onChange: <K extends keyof TaskFilterValues>(
    key: K,
    value: TaskFilterValues[K],
  ) => void;
  onClear: () => void;
}) {
  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search grows to fill; the selects stay compact. */}
        <div className="min-w-[200px] flex-1">
          <label htmlFor="task-search" className="sr-only">
            Search tasks
          </label>

          <input
            id="task-search"
            type="search"
            value={filters.search}
            onChange={(event) => onChange('search', event.target.value)}
            placeholder="Search by title, description, or ID..."
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        <Select
          label="Priority"
          value={filters.priority}
          options={PRIORITIES}
          onChange={(value) =>
            onChange('priority', value as TaskFilterValues['priority'])
          }
        />

        <Select
          label="Status"
          value={filters.status}
          options={STATUSES}
          onChange={(value) =>
            onChange('status', value as TaskFilterValues['status'])
          }
        />

        {/* Only shown when there is more than one category -- a dropdown with a
            single option is noise, not a control. */}
        {categories.length > 1 && (
          <Select
            label="Category"
            value={filters.category}
            options={categories}
            onChange={(value) => onChange('category', value)}
          />
        )}

        {isFiltering && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md px-2.5 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            Clear
          </button>
        )}
      </div>

      {/* The count is only shown WHILE FILTERING. Rendering "6 of 6" when no filter
          is active is noise; "2 of 6" while filtering is information. */}
      {isFiltering && (
        <p className="mt-2 text-xs text-slate-500">
          Showing {resultCount} of {totalCount} tasks
        </p>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <>
      <label htmlFor={`filter-${label}`} className="sr-only">
        Filter by {label}
      </label>

      <select
        id={`filter-${label}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
      >
        <option value="All">{label}: All</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </>
  );
}
