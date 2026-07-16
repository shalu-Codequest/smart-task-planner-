import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { AppError } from '../src/errors/AppError.js';
import { ErrorCode } from '../src/errors/error-codes.js';
import { validate } from '../src/middleware/validate.js';
import type { FieldIssue } from '../src/types/api.types.js';

/**
 * Validation middleware tests.
 *
 * The middleware is exercised directly with fake req/res/next objects rather than
 * through a running server. That keeps these fast and focused on the one behaviour
 * that matters: does it PARSE, REPLACE, and FORWARD correctly.
 */

const schema = z.object({
  title: z.string().trim().min(1),
  count: z.number().positive(),
  tags: z
    .array(z.string())
    .default([])
    .transform((t) => [...new Set(t)]),
});

function mockRequest(part: 'body' | 'query' | 'params', value: unknown): Request {
  return { [part]: value } as unknown as Request;
}

describe('validate middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('calls next with no argument when the payload is valid', () => {
    const req = mockRequest('body', { title: 'Task', count: 3 });

    validate(schema)(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('replaces the request value with the PARSED output', () => {
    const req = mockRequest('body', {
      title: '  Task  ',
      count: 3,
      tags: ['a', 'a', 'b'],
    });

    validate(schema)(req, {} as Response, next);

    // Trimmed by the schema, and duplicates removed by the transform. This is the
    // single most important assertion in the file: without the write-back, the
    // dependency dedupe would silently never happen and the planner would report
    // phantom cycles.
    expect(req.body).toEqual({ title: 'Task', count: 3, tags: ['a', 'b'] });
  });

  it('applies schema defaults to the request value', () => {
    const req = mockRequest('body', { title: 'Task', count: 3 });

    validate(schema)(req, {} as Response, next);

    expect(req.body.tags).toEqual([]);
  });

  it('forwards a VALIDATION_ERROR AppError when the payload is invalid', () => {
    const req = mockRequest('body', { title: '', count: -1 });

    validate(schema)(req, {} as Response, next);

    const error = (next as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as AppError;

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.statusCode).toBe(400);
  });

  it('reports every failing field, not just the first', () => {
    const req = mockRequest('body', { title: '', count: -1 });

    validate(schema)(req, {} as Response, next);

    const error = (next as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as AppError;
    const { issues } = error.details as { issues: FieldIssue[] };

    expect(issues.map((i) => i.field).sort()).toEqual(['count', 'title']);
  });

  it('does not mutate the request when validation fails', () => {
    const original = { title: '', count: -1 };
    const req = mockRequest('body', original);

    validate(schema)(req, {} as Response, next);

    expect(req.body).toBe(original);
  });

  it('validates the query part when told to', () => {
    const querySchema = z.object({ search: z.string().trim().optional() });
    const req = mockRequest('query', { search: '  login  ' });

    validate(querySchema, 'query')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ search: 'login' });
  });

  it('validates the params part when told to', () => {
    const paramsSchema = z.object({ id: z.string().min(1) });
    const req = mockRequest('params', { id: 'T1' });

    validate(paramsSchema, 'params')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.params).toEqual({ id: 'T1' });
  });
});
