import type { NextFunction, Request, Response } from 'express';

import { taskService } from '../services/index.js';
import type {
  CreateTaskDto,
  TaskQueryDto,
  UpdateTaskDto,
} from '../validators/task.schema.js';

/**
 * HTTP adapter for the task API.
 *
 * Each handler does exactly three things: read the validated input, call the
 * service, shape the response. There is no branching in this file -- every branch
 * is a business decision, and business decisions live in the service. The payoff
 * is that the HTTP surface could be replaced with GraphQL or a CLI without
 * touching a line of business logic.
 *
 * On the type assertions
 * ----------------------
 * By the time a handler runs, `validate()` has already parsed the relevant part
 * of the request with Zod and written the parsed value back onto it, so `req.body`
 * really is a `CreateTaskDto` -- trimmed, defaulted, deduped. The assertion
 * documents an invariant that the route table guarantees.
 *
 * The rigorous alternative is module augmentation of Express's `Request` with
 * generic body/query types. That is the right answer for a fifty-endpoint API; it
 * is a meaningful amount of declaration-merging machinery for five. The narrow,
 * documented assertion is confined to this one file instead.
 *
 * On the try/catch
 * ----------------
 * These handlers are synchronous -- the store is in-memory, nothing is awaited --
 * and Express 4 already catches synchronous throws, so the blocks are technically
 * redundant today. They are kept because the moment any service method becomes
 * async (a real database), Express 4 would silently stop catching and every error
 * would become an unhandled rejection that hangs the request. The try/catch is
 * what makes that transition safe.
 */

export function getAllTasks(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    res.json(taskService.getAll(req.query as TaskQueryDto));
  } catch (error) {
    next(error);
  }
}

export function getTaskById(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const { id } = req.params as { id: string };

    res.json(taskService.getById(id));
  } catch (error) {
    next(error);
  }
}

export function createTask(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const created = taskService.create(req.body as CreateTaskDto);

    // 201 + Location: the correct semantics for resource creation.
    res.status(201).location(`/tasks/${created.id}`).json(created);
  } catch (error) {
    next(error);
  }
}

export function updateTask(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const { id } = req.params as { id: string };

    res.json(taskService.update(id, req.body as UpdateTaskDto));
  } catch (error) {
    next(error);
  }
}

export function deleteTask(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const { id } = req.params as { id: string };

    taskService.delete(id);

    // 204 No Content. Returning the deleted object would assert that it still
    // exists, which is exactly what the request just made false.
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
