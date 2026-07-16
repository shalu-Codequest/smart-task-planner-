import { BrowserRouter, Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import { TaskProvider } from './context/TaskContext';
import PlanPage from './pages/PlanPage';
import TasksPage from './pages/TasksPage';

/**
 * Composition root.
 *
 * TaskProvider wraps the Router rather than the other way round, so the store
 * survives navigation: move to the plan page and back and the task list is still
 * there, with no refetch and no flash of empty state. A provider inside a route
 * would unmount on navigation and reset the store every time the user switched
 * tabs.
 */
export default function App() {
  return (
    <TaskProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<TasksPage />} />
            <Route path="plan" element={<PlanPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TaskProvider>
  );
}

function NotFound() {
  return <p className="text-sm text-slate-500">Page not found.</p>;
}
