import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

import { createApp } from '../src/app.js';
import { ErrorCode } from '../src/errors/error-codes.js';
import { loadSeedData } from '../src/repositories/index.js';

/**
 * HTTP integration tests.
 *
 * These close a gap that unit tests structurally cannot. The service layer and the
 * planner are both exhaustively tested, but nothing in those tests exercises the
 * routing table -- and the routing table contains a genuine trap:
 *
 *     GET /tasks/plan  must be registered before  GET /tasks/:id
 *
 * If someone reorders those routes (alphabetising the file, say), Express matches
 * 'plan' as an :id parameter, the plan endpoint 404s, and every other test still
 * passes. That is precisely the class of bug an integration test is for: a
 * property of the wiring, not of any code path.
 *
 * `createApp()` returns the app without calling listen(), so these run in-process
 * with no port binding -- no conflicts, no async teardown, no flakiness. That is
 * the reason app.ts and server.ts are separate files.
 */
describe('HTTP API', () => {
  let app: Express;

  beforeEach(() => {
    // Reseed before each spec so they are independent and order-insensitive.
    loadSeedData();
    app = createApp();
  });

  describe('GET /health', () => {
    it('reports ok', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.status).toBe('ok');
    });
  });

  // ==========================================================================
  // THE ROUTE-ORDER TRAP
  // ==========================================================================

  describe('route registration order', () => {
    it('resolves GET /tasks/plan to the PLANNER, not to :id', async () => {
      // The test this file exists for. If /:id were registered first, this would
      // return 404 TASK_NOT_FOUND for a task called "plan".
      const response = await request(app).get('/tasks/plan').expect(200);

      expect(response.body).toHaveProperty('entries');
      expect(response.body).toHaveProperty('waveCount');
      expect(response.body.error).toBeUndefined();
    });

    it('still resolves GET /tasks/:id for a real id', async () => {
      // Proving the static route did not swallow the parameterised one.
      const response = await request(app).get('/tasks/T1').expect(200);

      expect(response.body.id).toBe('T1');
    });
  });

  // ==========================================================================
  // CRUD
  // ==========================================================================

  describe('GET /tasks', () => {
    it('returns the seeded tasks', async () => {
      const response = await request(app).get('/tasks').expect(200);

      expect(response.body).toHaveLength(6);
    });

    it('filters by priority', async () => {
      const response = await request(app)
        .get('/tasks?priority=High')
        .expect(200);

      expect(response.body.map((t: { id: string }) => t.id)).toEqual([
        'T1',
        'T2',
        'T4',
        'T5',
      ]);
    });

    it('searches the title AND the description, not just the title', async () => {
      // 'login' appears in T2's title ("Create login API") and in T5's
      // description ("Wire the dashboard to the login API..."). Both must match.
      //
      // A search that only looked at titles would return just T2 -- and would
      // silently hide a task the user was looking for.
      const response = await request(app).get('/tasks?search=login').expect(200);

      expect(response.body.map((t: { id: string }) => t.id)).toEqual(['T2', 'T5']);
    });

    it('matches a term that appears ONLY in a description', async () => {
      // 'authentication' appears in T2's description and in no task title at all.
      // If this returns nothing, description search is broken.
      const response = await request(app)
        .get('/tasks?search=authentication')
        .expect(200);

      expect(response.body.map((t: { id: string }) => t.id)).toEqual(['T2']);
    });

    it('combines filters with AND semantics', async () => {
      const response = await request(app)
        .get('/tasks?priority=High&category=Frontend')
        .expect(200);

      expect(response.body.map((t: { id: string }) => t.id)).toEqual(['T5']);
    });

    it('rejects an invalid priority filter', async () => {
      const response = await request(app)
        .get('/tasks?priority=Urgent')
        .expect(400);

      expect(response.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('GET /tasks/:id', () => {
    it('returns 404 with the standard envelope for an unknown id', async () => {
      const response = await request(app).get('/tasks/MISSING').expect(404);

      expect(response.body.error.code).toBe(ErrorCode.TASK_NOT_FOUND);
      expect(response.body.error.details).toEqual({ id: 'MISSING' });
    });
  });

  describe('POST /tasks', () => {
    it('creates a task with 201 and a Location header', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({
          title: 'Deploy',
          priority: 'Low',
          estimatedEffort: 1,
          category: 'Ops',
        })
        .expect(201);

      expect(response.headers.location).toBe(`/tasks/${response.body.id}`);
      expect(response.body.status).toBe('To Do'); // schema default applied
    });

    it('DEDUPLICATES dependencies through the full HTTP path', async () => {
      // Proves the validation middleware writes back the parsed value. If it
      // discarded the parse result, this would return ['T1','T1','T1'] and the
      // planner would later report a phantom cycle.
      const response = await request(app)
        .post('/tasks')
        .send({
          title: 'Dedupe check',
          priority: 'Low',
          estimatedEffort: 1,
          category: 'Test',
          dependencies: ['T1', 'T1', 'T1'],
        })
        .expect(201);

      expect(response.body.dependencies).toEqual(['T1']);
    });

    it('reports every invalid field at once', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({
          title: '',
          priority: 'Urgent',
          estimatedEffort: -5,
          category: '',
        })
        .expect(400);

      const fields = response.body.error.details.issues
        .map((i: { field: string }) => i.field)
        .sort();

      expect(fields).toEqual([
        'category',
        'estimatedEffort',
        'priority',
        'title',
      ]);
    });

    it('rejects a dependency on a task that does not exist', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({
          title: 'Ghost dependency',
          priority: 'High',
          estimatedEffort: 1,
          category: 'Test',
          dependencies: ['T97', 'T98'],
        })
        .expect(400);

      expect(response.body.error.code).toBe(ErrorCode.UNKNOWN_DEPENDENCY);
      expect(response.body.error.details.missingIds).toEqual(['T97', 'T98']);
    });

    it('returns 400 for malformed JSON, not 500', async () => {
      const response = await request(app)
        .post('/tasks')
        .set('Content-Type', 'application/json')
        .send('{"title":')
        .expect(400);

      expect(response.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('PUT /tasks/:id', () => {
    it('applies a partial update', async () => {
      const response = await request(app)
        .put('/tasks/T3')
        .send({ status: 'In Progress' })
        .expect(200);

      expect(response.body.status).toBe('In Progress');
      expect(response.body.title).toBe('Create dashboard UI'); // untouched
    });

    it('rejects an unknown key (strict schema)', async () => {
      const response = await request(app)
        .put('/tasks/T3')
        .send({ id: 'HACKED' })
        .expect(400);

      expect(response.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('returns 204 with no body for a leaf task', async () => {
      const response = await request(app).delete('/tasks/T6').expect(204);

      expect(response.body).toEqual({});
      await request(app).get('/tasks/T6').expect(404);
    });

    it('BLOCKS a delete with 409 and names the blocking tasks', async () => {
      // T2, T3 and T4 all depend on T1.
      const response = await request(app).delete('/tasks/T1').expect(409);

      expect(response.body.error.code).toBe(ErrorCode.DEPENDENCY_CONFLICT);
      expect(response.body.error.details.dependentIds).toEqual([
        'T2',
        'T3',
        'T4',
      ]);
    });
  });

  // ==========================================================================
  // THE PLAN ENDPOINT
  // ==========================================================================

  describe('GET /tasks/plan', () => {
    it('returns the plan in the brief-specified order', async () => {
      const response = await request(app).get('/tasks/plan').expect(200);

      // After T1, the ready set is {T2 High/5, T3 Med/3, T4 High/2, T6 Low/1}.
      // Rule 1 (priority): T4 and T2 tie at High and beat T3 (Med) and T6 (Low).
      // Rule 2 (effort):   T4 (2) beats T2 (5).
      expect(response.body.entries.map((e: { task: { id: string } }) => e.task.id))
        .toEqual(['T1', 'T4', 'T2', 'T3', 'T5', 'T6']);
    });

    it('exposes the wave for each entry', async () => {
      const response = await request(app).get('/tasks/plan').expect(200);

      const waveOf = (id: string) =>
        response.body.entries.find(
          (e: { task: { id: string } }) => e.task.id === id,
        ).wave;

      expect(waveOf('T1')).toBe(1);
      expect(waveOf('T4')).toBe(2);
      expect(waveOf('T5')).toBe(3);
    });

    it('exposes the scheduling metrics', async () => {
      const response = await request(app).get('/tasks/plan').expect(200);

      expect(response.body.totalEffort).toBe(17);
      // Longest weighted chain: T1(2) -> T2(5) -> T5(4) = 11.
      expect(response.body.criticalPathEffort).toBe(11);
      expect(response.body.waveCount).toBe(3);
    });

    it('returns 409 with the CYCLE PATH when a cycle exists', async () => {
      // The service permits this write by design; the planner is what refuses.
      // This is the end-to-end proof of the "cycles caught at plan time" decision.
      await request(app)
        .put('/tasks/T2')
        .send({ dependencies: ['T5'] })
        .expect(200);

      const response = await request(app).get('/tasks/plan').expect(409);

      expect(response.body.error.code).toBe(ErrorCode.CYCLE_DETECTED);

      const { cyclePath } = response.body.error.details;

      // A closed loop -- first and last node are the same.
      expect(cyclePath[0]).toBe(cyclePath[cyclePath.length - 1]);
      expect(new Set(cyclePath)).toEqual(new Set(['T2', 'T5']));
      expect(response.body.error.message).toContain('->');
    });

    it('recovers once the cycle is broken', async () => {
      await request(app).put('/tasks/T2').send({ dependencies: ['T5'] });
      await request(app).get('/tasks/plan').expect(409);

      await request(app).put('/tasks/T2').send({ dependencies: ['T1'] });

      await request(app).get('/tasks/plan').expect(200);
    });

    it('excludes Done tasks but keeps them as satisfied dependencies', async () => {
      await request(app).put('/tasks/T1').send({ status: 'Done' }).expect(200);

      const response = await request(app).get('/tasks/plan').expect(200);

      expect(response.body.excludedCompletedIds).toEqual(['T1']);
      expect(response.body.totalTasks).toBe(5);

      // T1's dependents are now unblocked -- their only prerequisite is satisfied,
      // so they move to wave 1. If the planner had left the edge in, they would be
      // permanently blocked and Kahn's would report a phantom cycle.
      const waveOf = (id: string) =>
        response.body.entries.find(
          (e: { task: { id: string } }) => e.task.id === id,
        ).wave;

      expect(waveOf('T4')).toBe(1);
      expect(waveOf('T2')).toBe(1);
    });
  });

  // ==========================================================================
  // ERROR ENVELOPE CONSISTENCY
  // ==========================================================================

  describe('error envelope', () => {
    it('uses the same shape for an unmatched route as for a domain error', async () => {
      const response = await request(app).get('/nope').expect(404);

      expect(response.body.error.code).toBe(ErrorCode.ROUTE_NOT_FOUND);
      expect(response.body.error).toHaveProperty('message');
    });
  });
});
