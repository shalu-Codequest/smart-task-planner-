/**
 * The empty list.
 *
 * An empty list can mean three different things, and showing the same message for
 * all of them is disorienting:
 *
 *   1. No tasks exist yet      -> "Create your first task"    (an invitation)
 *   2. Tasks exist, none match -> "No matches. Clear filters" (an escape hatch)
 *   3. The fetch failed        -> handled by ErrorBanner      (not here)
 *
 * Case 2 is the one that gets missed. A user filters to "Done", sees "No tasks yet
 * -- create one", and reasonably concludes their tasks were deleted. The fix costs
 * one boolean prop and removes an entire class of confused bug report.
 */
export default function EmptyState({
  isFiltering,
  onClearFilters,
  onCreate,
}: {
  isFiltering: boolean;
  onClearFilters: () => void;
  onCreate: () => void;
}) {
  if (isFiltering) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white py-12 text-center">
        <p className="text-sm font-medium text-slate-700">No matching tasks</p>

        <p className="mt-1 text-xs text-slate-500">
          Your tasks are still here &mdash; the current filters just don&apos;t match
          any of them.
        </p>

        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white py-12 text-center">
      <p className="text-sm font-medium text-slate-700">No tasks yet</p>

      <p className="mt-1 text-xs text-slate-500">
        Create a task to start building an execution plan.
      </p>

      <button
        type="button"
        onClick={onCreate}
        className="mt-4 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
      >
        Create your first task
      </button>
    </div>
  );
}
