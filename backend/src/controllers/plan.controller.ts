import type { NextFunction, Request, Response } from 'express';

import { plannerService, taskService } from '../services/index.js';

/**
 * HTTP adapter for the execution plan.
 *
 * Fetch the tasks, transform them, respond. Every hard decision -- how to build
 * the graph, which task to pick from the ready set, what to do about a cycle --
 * was made in the planner. If this file needed branching, it would mean business
 * logic had leaked out of the service.
 *
 * On the cycle error
 * ------------------
 * `generatePlan` throws `AppError.cycleDetected(path)`, which is not caught here.
 * It goes to `next(error)`, and the shared error handler turns it into a 409 with
 * the cycle path in `details`. No special handling, no plan-specific error code
 * in the controller. That is what a single error exit point buys: a new failure
 * mode costs a factory method, not a new branch in every handler.
 *
 * On ignoring query filters
 * -------------------------
 * `taskService.getAll()` is called with no filters, even though GET /tasks
 * supports them. This is deliberate.
 *
 * A dependency graph is only correct as a whole. Filter out a Low-priority task
 * and every task that depended on it becomes a false root -- the plan would place
 * them at wave 1 and claim they are ready to start, when in reality they are
 * blocked by work the filter hid. The result is not a partial plan; it is a wrong
 * plan that looks authoritative.
 *
 * Filtering is a view concern; the plan is a computed truth about the whole
 * graph. If a user wants to see only their own tasks within the plan, the
 * frontend can highlight or dim entries -- the ordering must still be computed
 * over everything.
 */
export function getExecutionPlan(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const tasks = taskService.getAll();

    res.json(plannerService.generatePlan(tasks));
  } catch (error) {
    next(error);
  }
}
