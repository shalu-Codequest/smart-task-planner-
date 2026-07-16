import type { Task } from '../types/task.types.js';

/**
 * Seed data loaded into the in-memory repository on boot.
 *
 * Deliberately shaped to exercise the planner's interesting paths, so that a
 * reviewer opening the app sees meaningful behaviour immediately:
 *
 *   - T1 is a root (no dependencies)
 *   - T2, T3, T4 all depend on T1 -> a fan-out, forcing the comparator to break
 *     the tie. This is Example 2 from the assignment brief, verbatim.
 *   - T5 depends on T2 and T3     -> a join / diamond
 *   - T6 is fully disconnected    -> proves the planner handles multiple roots
 *                                    and disconnected components
 *
 * Expected plan: T1 -> T4 -> T2 -> T3 -> T5 -> T6
 *
 * The graph is intentionally acyclic. The cycle path is covered by unit tests
 * rather than seed data, because shipping a broken plan by default would be a
 * poor first impression.
 */
export const seedTasks: Task[] = [
  {
    id: 'T1',
    title: 'Setup project',
    description: 'Initialise the repository, tooling and CI skeleton.',
    priority: 'High',
    estimatedEffort: 2,
    category: 'Infrastructure',
    dependencies: [],
    status: 'To Do',
  },
  {
    id: 'T2',
    title: 'Create login API',
    description: 'Implement the authentication endpoints and session handling.',
    priority: 'High',
    estimatedEffort: 5,
    category: 'Backend',
    dependencies: ['T1'],
    status: 'To Do',
  },
  {
    id: 'T3',
    title: 'Create dashboard UI',
    description: 'Build the dashboard screen and its layout components.',
    priority: 'Medium',
    estimatedEffort: 3,
    category: 'Frontend',
    dependencies: ['T1'],
    status: 'To Do',
  },
  {
    id: 'T4',
    title: 'Write unit tests',
    description: 'Cover the core planning logic with unit tests.',
    priority: 'High',
    estimatedEffort: 2,
    category: 'Quality',
    dependencies: ['T1'],
    status: 'To Do',
  },
  {
    id: 'T5',
    title: 'Integrate UI with API',
    description: 'Wire the dashboard to the login API and handle error states.',
    priority: 'High',
    estimatedEffort: 4,
    category: 'Frontend',
    dependencies: ['T2', 'T3'],
    status: 'To Do',
  },
  {
    id: 'T6',
    title: 'Write API documentation',
    description: 'Document all endpoints, payloads and error codes.',
    priority: 'Low',
    estimatedEffort: 1,
    category: 'Documentation',
    dependencies: [],
    status: 'To Do',
  },
];
