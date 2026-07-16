import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../src/errors/AppError.js';
import { ErrorCode } from '../src/errors/error-codes.js';
import {
  errorHandler,
  notFoundHandler,
} from '../src/middleware/error-handler.js';
import type { ApiErrorResponse } from '../src/types/api.types.js';

/**
 * Error handler tests.
 *
 * The behaviour under test is the mapping: AppError -> status + envelope; unknown
 * error -> opaque 500. The second is a security property, not just a formatting
 * one, and is tested as such -- otherwise someone adds `message: error.message`
 * while debugging and never takes it out.
 */

interface MockResponse extends Response {
  statusCode: number;
  body: ApiErrorResponse;
}

function mockResponse(): MockResponse {
  const res = {} as MockResponse;

  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as unknown as Response['status'];

  res.json = vi.fn((payload: ApiErrorResponse) => {
    res.body = payload;
    return res;
  }) as unknown as Response['json'];

  return res;
}

describe('errorHandler', () => {
  const next = vi.fn() as NextFunction;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('maps an AppError to its own status code', () => {
    const res = mockResponse();

    errorHandler(AppError.taskNotFound('T9'), {} as Request, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe(ErrorCode.TASK_NOT_FOUND);
  });

  it('uses 409 for a conflict, not a blanket 400', () => {
    const res = mockResponse();

    errorHandler(
      AppError.dependencyConflict('T1', ['T2']),
      {} as Request,
      res,
      next,
    );

    expect(res.statusCode).toBe(409);
  });

  it('preserves the details payload so the client can act on it', () => {
    const res = mockResponse();

    errorHandler(
      AppError.cycleDetected(['T1', 'T2', 'T1']),
      {} as Request,
      res,
      next,
    );

    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe(ErrorCode.CYCLE_DETECTED);
    expect(res.body.error.details).toEqual({ cyclePath: ['T1', 'T2', 'T1'] });
  });

  it('omits details entirely when there are none', () => {
    const res = mockResponse();

    errorHandler(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, 'Boom'),
      {} as Request,
      res,
      next,
    );

    expect('details' in res.body.error).toBe(false);
  });

  it('converts an unknown error into an opaque 500', () => {
    const res = mockResponse();

    errorHandler(
      new TypeError('cannot read property of undefined'),
      {} as Request,
      res,
      next,
    );

    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(res.body.error.message).toBe('An unexpected error occurred.');
  });

  it('does not leak the internal message in the top-level message field', () => {
    const res = mockResponse();
    const secret = '/srv/app/src/internals.ts:42 -- connection string leaked';

    errorHandler(new Error(secret), {} as Request, res, next);

    expect(res.body.error.message).not.toContain(secret);
  });

  it('logs the unknown error server-side so the operator still sees it', () => {
    const res = mockResponse();
    const error = new Error('boom');

    errorHandler(error, {} as Request, res, next);

    expect(console.error).toHaveBeenCalledWith('[unhandled error]', error);
  });

  it('handles a thrown non-Error value without crashing', () => {
    const res = mockResponse();

    errorHandler('a bare string was thrown', {} as Request, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
  });
});

describe('notFoundHandler', () => {
  it('returns a 404 in the same envelope shape as every other error', () => {
    const res = mockResponse();
    const req = { method: 'GET', originalUrl: '/nope' } as Request;

    notFoundHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe(ErrorCode.ROUTE_NOT_FOUND);
    expect(res.body.error.message).toContain('/nope');
  });
});
