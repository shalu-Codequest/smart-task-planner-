import { z } from 'zod';

import {
  MAX_ESTIMATED_EFFORT,
  PRIORITIES,
  STATUSES,
} from '../config/constants.js';

/**
 * Structural validation for the task API.
 *
 * These schemas validate payload shape and allowed values. Dependency existence
 * is handled separately in the service layer.
 */

/** Non-empty, trimmed task identifier. */
const taskIdSchema = z
  .string()
  .trim()
  .min(1, 'Task id cannot be empty')
  .max(50, 'Task id cannot exceed 50 characters');

/**
 * Dependency list.
 *
 * Duplicate ids are normalized away so the planner can rely on a unique set of
 * dependencies.
 */
const dependenciesSchema = z
  .array(taskIdSchema)
  .default([])
  .transform((ids) => [...new Set(ids)]);

const effortSchema = z
  .number({ invalid_type_error: 'estimatedEffort must be a number' })
  .positive('estimatedEffort must be greater than zero')
  .max(
    MAX_ESTIMATED_EFFORT,
    `estimatedEffort cannot exceed ${MAX_ESTIMATED_EFFORT}`,
  );

/**
 * Schema for POST /tasks.
 *
 * The id is optional because the service generates one when it is absent.
 */
export const createTaskSchema = z
  .object({
    id: taskIdSchema.optional(),
    title: z.string().trim().min(1, 'Title is required').max(200),
    description: z.string().trim().max(2000).default(''),
    priority: z.enum(PRIORITIES, {
      errorMap: () => ({
        message: `Priority must be one of: ${PRIORITIES.join(', ')}`,
      }),
    }),
    estimatedEffort: effortSchema,
    category: z.string().trim().min(1, 'Category is required').max(100),
    dependencies: dependenciesSchema,
    status: z
      .enum(STATUSES, {
        errorMap: () => ({
          message: `Status must be one of: ${STATUSES.join(', ')}`,
        }),
      })
      .default('To Do'),
  })
  .superRefine((task, ctx) => {
    if (task.id && task.dependencies.includes(task.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dependencies'],
        message: `Task '${task.id}' cannot depend on itself`,
      });
    }
  });

/**
 * Schema for PUT /tasks/:id.
 *
 * Updates are partial. The id is not part of the body because task identity is
 * immutable and is carried in the route.
 */
export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000),
    priority: z.enum(PRIORITIES),
    estimatedEffort: effortSchema,
    category: z.string().trim().min(1).max(100),
    dependencies: dependenciesSchema,
    status: z.enum(STATUSES),
  })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Update payload cannot be empty',
  });

/** Schema for the `:id` route parameter. */
export const taskIdParamSchema = z.object({
  id: taskIdSchema,
});

/**
 * Schema for the GET /tasks query string.
 *
 * Empty strings are normalized to undefined so empty filters behave the same as
 * omitted filters.
 */
export const taskQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(STATUSES).optional(),
  category: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
});

// --- Derived types -----------------------------------------------------------
// Inferring from the schema guarantees the runtime contract and the compile-time
// type can never fall out of sync.

export type CreateTaskDto = z.infer<typeof createTaskSchema>;
export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;
export type TaskIdParam = z.infer<typeof taskIdParamSchema>;
export type TaskQueryDto = z.infer<typeof taskQuerySchema>;
