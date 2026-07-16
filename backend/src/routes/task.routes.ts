import { Router } from 'express';

import { getExecutionPlan } from '../controllers/plan.controller.js';
import {
  createTask,
  deleteTask,
  getAllTasks,
  getTaskById,
  updateTask,
} from '../controllers/task.controller.js';
import { validate } from '../middleware/validate.js';
import {
  createTaskSchema,
  taskIdParamSchema,
  taskQuerySchema,
  updateTaskSchema,
} from '../validators/task.schema.js';

/**
 * Task route definitions.
 *
 * Each route declares its own validation contract inline. That placement is
 * deliberate: a reviewer reading this file sees, in one line, both what a URL does
 * and what it accepts. Hiding validation inside the controller would make the
 * contract invisible from the route table.
 *
 * ==========================================================================
 * ROUTE ORDER IS LOAD-BEARING. DO NOT REORDER.
 * ==========================================================================
 *
 * `GET /plan` must be registered before `GET /:id`.
 *
 * Express matches routes top-down and takes the first match. `/:id` is a wildcard
 * that matches any single path segment, including the literal string 'plan'. If
 * `/:id` came first, a request to GET /tasks/plan would match it with id='plan',
 * the service would look for a task called "plan", find nothing, and return:
 *
 *     404 TASK_NOT_FOUND -- Task 'plan' does not exist.
 *
 * The plan endpoint would be silently unreachable, and the error message would
 * point nowhere near the actual cause -- a one-line fix that costs an hour to
 * find.
 *
 * The general rule: static segments always precede parameterised ones.
 */
const router = Router();

// --- Static routes (must come first) -----------------------------------------

router.get('/plan', getExecutionPlan);

// --- Collection routes -------------------------------------------------------

router.get('/', validate(taskQuerySchema, 'query'), getAllTasks);

router.post('/', validate(createTaskSchema, 'body'), createTask);

// --- Parameterised routes (must come last) -----------------------------------

router.get('/:id', validate(taskIdParamSchema, 'params'), getTaskById);

router.put(
  '/:id',
  validate(taskIdParamSchema, 'params'),
  validate(updateTaskSchema, 'body'),
  updateTask,
);

router.delete('/:id', validate(taskIdParamSchema, 'params'), deleteTask);

export default router;
