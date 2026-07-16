import { useContext } from 'react';

import { TaskContext } from '../context/TaskContext';

/**
 * The only way components touch task state.
 *
 * The null check is not defensive noise. `createContext<T | null>(null)` means the
 * raw context type includes null, and without this every consumer would write
 * `useContext(TaskContext)?.tasks` and handle a null that can only occur through a
 * wiring mistake.
 *
 * Throwing here converts a silent runtime bug -- a component rendered outside the
 * provider, showing an empty list forever with no clue why -- into an immediate,
 * named crash. It also narrows the type, so every consumer gets a non-null value
 * with no optional chaining.
 */
export function useTasks() {
  const context = useContext(TaskContext);

  if (!context) {
    throw new Error('useTasks must be used within a <TaskProvider>.');
  }

  return context;
}
