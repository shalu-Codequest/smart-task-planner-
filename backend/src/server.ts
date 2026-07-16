import { createApp } from './app.js';
import { config } from './config/env.js';
import { loadSeedData, taskRepository } from './repositories/index.js';

/**
 * Process entry point.
 *
 * Seeding happens here rather than inside `createApp` so that `createApp`
 * stays free of side effects -- tests construct the app and seed the
 * repository independently, in whatever combination each spec needs.
 */
loadSeedData();

const app = createApp();

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
  console.log(`Health check:     http://localhost:${config.port}/health`);
  console.log(`Execution plan:   http://localhost:${config.port}/tasks/plan`);
  console.log(`Seeded ${taskRepository.count()} tasks.`);
});
