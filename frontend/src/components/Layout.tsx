import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useTasks } from '../hooks/useTasks';

/**
 * The application shell: header, nav, routed content.
 *
 * `<Outlet />` is where react-router renders the matched child route. A layout
 * route rather than a header repeated in each page means the nav does not unmount
 * and remount on navigation.
 *
 * The stale-plan dot
 * ------------------
 * Lets the user edit a dependency on the task page and see that the plan they last
 * looked at no longer reflects it. Without the indicator they would navigate to a
 * plan that silently refetches, or sit on a stale one -- and in a planning tool, a
 * stale plan is the tool confidently telling them to do the wrong thing next.
 */
export default function Layout() {
  const { tasks, planStale } = useTasks();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Smart Task Planner
            </h1>

            <p className="text-xs text-slate-500">
              Dependency-aware execution planning
            </p>
          </div>

          <nav className="flex gap-1" aria-label="Main">
            <NavItem to="/">
              Tasks
              <span className="ml-1.5 text-xs text-slate-400">{tasks.length}</span>
            </NavItem>

            <NavItem to="/plan">
              Execution Plan
              {planStale && (
                <span
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
                  title="The plan is out of date -- tasks have changed since it was generated"
                  aria-label="Plan is out of date"
                />
              )}
            </NavItem>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        [
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-slate-900 text-white'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  );
}
