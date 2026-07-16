import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';

import { config } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import taskRouter from './routes/task.routes.js';

/**
 * Builds and configures the Express application.
 *
 * The returned app is ready for in-process tests and local wiring. Middleware
 * order matters: CORS and body parsing must run before routes, and the error
 * handlers must be registered last.
 */
export function createApp(): Express {
  const app = express();

  // --- Global middleware -----------------------------------------------------
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  // --- Health check ----------------------------------------------------------
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'smart-task-planner-api' });
  });

  // --- Feature routers -------------------------------------------------------
  app.use('/tasks', taskRouter);

  // --- Error handling (must be registered last) ------------------------------
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
