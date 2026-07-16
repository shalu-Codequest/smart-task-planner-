/**
 * Loading placeholder.
 *
 * A skeleton rather than a spinner, because it preserves layout. A spinner
 * collapses the page to nothing and then everything snaps into place -- the
 * content jumps, and on a slow connection the user watches the page rearrange
 * itself. A skeleton holds the space, so the transition to real content is a fill
 * rather than a reflow.
 */
export default function TaskListSkeleton() {
  return (
    <ul className="space-y-2" aria-busy="true" aria-label="Loading tasks">
      {[0, 1, 2, 3].map((index) => (
        <li
          key={index}
          className="animate-pulse rounded-lg border border-slate-200 bg-white p-4"
        >
          <div className="h-4 w-1/3 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />

          <div className="mt-3 flex gap-1.5">
            <div className="h-4 w-12 rounded bg-slate-100" />
            <div className="h-4 w-16 rounded bg-slate-100" />
            <div className="h-4 w-10 rounded bg-slate-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}
