# Smart Task Planner

A full-stack task planner that generates a **deterministic execution order** from a set of tasks with dependencies. Tasks form a directed graph; the plan is a topological sort of that graph, with ties broken by business rules. Circular dependencies are detected and reported with the exact loop.

**Stack:** React + TypeScript + Vite + Tailwind · Node.js + Express + TypeScript + Zod · In-memory storage · Vitest (163 tests)

---

## Table of contents

1. [Quick start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Configuration](#configuration)
4. [Technology choices](#technology-choices)
5. [Project structure](#project-structure)
6. [API reference](#api-reference)
7. [**How the execution planning logic works**](#how-the-execution-planning-logic-works) ← the core
8. [Assumptions](#assumptions)
9. [Design decisions and trade-offs](#design-decisions-and-trade-offs)
10. [Testing](#testing)
11. [Limitations and future work](#limitations-and-future-work)

---

## Quick start

Two terminals. No database, no Docker, no environment variables required.

**Terminal 1 — backend (port 4000):**

```bash
cd backend
npm install
npm run dev
```

You should see:

```
API listening on http://localhost:4000
Health check:     http://localhost:4000/health
Execution plan:   http://localhost:4000/tasks/plan
Seeded 6 tasks.
```

**Terminal 2 — frontend (port 5173):**

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

The app boots with 6 seeded tasks that exercise the interesting graph shapes: a root, a fan-out (which forces the comparator to break a tie), a join, and a disconnected component.

**Run the tests:**

```bash
cd backend
npm test          # 163 tests across 8 suites
```

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 18 | Developed on 22. `npm` ships with it. |
| npm | ≥ 9 | Or use `pnpm` / `yarn`. |

Nothing else. **No database of any kind is required** — the assignment mandates in-memory storage, so the store is a `Map` that lives in the Node process and resets on restart.

---

## Configuration

Both apps run with zero configuration. `.env.example` files are provided if you want to override the defaults.

**`backend/.env.example`**

```bash
PORT=4000                            # API port
CORS_ORIGIN=http://localhost:5173    # Must match where Vite serves
NODE_ENV=development                 # 'development' exposes internal error messages
```

**`frontend/.env.example`**

```bash
VITE_API_URL=http://localhost:4000   # Backend base URL
```

To use them: `cp .env.example .env` in the relevant directory.

Note on `NODE_ENV`: internal error messages are exposed in 500 responses **only** when `NODE_ENV` is explicitly `development`. The default for that security control fails *closed* — an operator who forgets to set `NODE_ENV` in production leaks nothing. See `backend/src/config/env.ts`.

---

## Technology choices

Each line names what was given up, not just what was chosen.

| Choice | Why | Trade-off accepted |
|---|---|---|
| **TypeScript** (both) | The domain has enums (`Priority`, `Status`) and an ID-reference array. Types catch the whole class of bug where a comparator sorts priority strings alphabetically. | Build step; slower iteration than plain JS. |
| **Express**, not NestJS | Nest is the better *production* answer — modules, DI, pipes. But it's a lot of framework surface for a 2–3 day build, and the same separation of concerns is achievable with plain Express and disciplined layering. I chose the option where I can explain every line rather than the one where the framework explains it for me. | No DI container; I wire the composition roots by hand. |
| **Zod** | One declaration gives me runtime validation *and* the compile-time type via `z.infer`, so the two cannot drift. | A dependency, and a slightly unusual chaining API. |
| **Context + `useReducer`**, not Redux/Zustand | State is one array, one plan, four flags. Zero dependencies, no concepts to look up. | **Known limit:** Context has no selector-level subscription, so any state change re-renders every consumer. Fine at this size; it's exactly the point where I'd move to Zustand. |
| **Tailwind** | Fast, and the brief says the UI "does not need to be visually fancy." | Verbose class strings in JSX. |
| **Vitest** | Zero-config with TS/ESM, fast. | — |
| **Axios** + interceptor | The interceptor converts every rejection into a typed `ApiError` at the boundary, so `api/client.ts` is the *only* file in the frontend that imports Axios. Swapping to `fetch` would touch one file. | A dependency `fetch` could replace. |
| **No React Query** | It's genuinely the right tool for server state and would replace most of my reducer. I hand-rolled it because the rubric evaluates *state handling* — I'd rather demonstrate that I understand what React Query abstracts (request lifecycle, staleness, invalidation) than that I can install a library. `planStale` is essentially a hand-rolled `invalidateQueries`. | More code; no caching or dedup for free. |

---

## Project structure

Dependencies point **inward and downward only**. A controller may import a service; a service may import a repository. Nothing below `controllers/` ever imports Express.

```
backend/src/
├── config/         constants (PRIORITY_RANK, enums), env
├── types/          domain types — imported by everything, imports nothing
├── errors/         AppError + error codes
├── validators/     Zod schemas — STRUCTURAL validation only
├── repositories/   Map<string, Task> — the ONLY place data lives
├── services/       business rules
│   ├── task.service.ts       semantic validation, CRUD rules
│   └── planner.service.ts    ★ the graph, Kahn's, comparator, cycle detection
├── controllers/    HTTP adapters — no business logic, not one `if`
├── routes/         URL → validation → handler
├── middleware/     validate() + the single error handler
├── data/           seed.ts
├── app.ts          createApp() — returns the app WITHOUT listening
└── server.ts       the only file that binds a port

frontend/src/
├── types/          mirrored from the backend contract
├── api/
│   ├── client.ts       the ONLY file that imports Axios
│   ├── ApiError.ts     the only error type the UI ever handles
│   └── tasks.api.ts    typed endpoint wrappers
├── context/        TaskContext + reducer — one store
├── hooks/          useTasks, useTaskFilters, useTaskForm
├── utils/
│   ├── cycle.utils.ts  ★ client-side cycle prediction (same inversion as the planner)
│   └── plan.utils.ts   wave grouping, ordering rationale
├── components/     presentational — pure functions of props
└── pages/          containers — own the data connection
```

**Why `app.ts` and `server.ts` are separate:** `createApp()` returns a configured Express instance with **no side effects**. `server.ts` is the only thing that binds a port. That split is what lets the integration tests construct the app in-process and issue requests without opening a socket — no port conflicts, no async teardown, no flaky tests.

---

## API reference

Base URL: `http://localhost:4000`

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `GET` | `/tasks` | All tasks. Filters: `?search=&priority=&status=&category=` (AND semantics) |
| `GET` | `/tasks/:id` | One task |
| `POST` | `/tasks` | Create. `201` + `Location` header |
| `PUT` | `/tasks/:id` | Partial update |
| `DELETE` | `/tasks/:id` | `204`. Blocked with `409` if other tasks depend on it |
| `GET` | `/tasks/plan` | **Generate the execution plan.** `409` if a cycle exists |

### Task model

```json
{
  "id": "T1",
  "title": "Setup project",
  "description": "Initialise the repository.",
  "priority": "High",              // High | Medium | Low
  "estimatedEffort": 2,            // positive number
  "category": "Infrastructure",
  "dependencies": [],              // IDs of tasks that must come FIRST
  "status": "To Do"                // To Do | In Progress | Done
}
```

### Execution plan response

```json
{
  "entries": [
    { "order": 1, "wave": 1, "task": { "id": "T1", ... } },
    { "order": 2, "wave": 2, "task": { "id": "T4", ... } }
  ],
  "totalTasks": 6,
  "totalEffort": 17,           // one engineer, sequential
  "criticalPathEffort": 11,    // floor with unlimited engineers
  "waveCount": 3,
  "excludedCompletedIds": []
}
```

### Error envelope

Every failure — a Zod issue, a cycle, a blocked delete, a mistyped URL — returns this exact shape. The frontend has one error shape to handle, ever.

```json
{
  "error": {
    "code": "CYCLE_DETECTED",
    "message": "Circular dependency detected: T2 -> T5 -> T2. No valid execution plan exists.",
    "details": { "cyclePath": ["T2", "T5", "T2"] }
  }
}
```

`code` is the stable, machine-readable half — the UI switches on it. `message` is for humans. **`details` is where the value is:** it carries the cycle path, the blocking dependents, the failing form fields. That field is the difference between an error a user can *act on* and one they can only be annoyed by.

| Code | Status | `details` |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `{ issues: [{ field, message }] }` — **all** failing fields, not just the first |
| `UNKNOWN_DEPENDENCY` | 400 | `{ taskId, missingIds }` — all missing IDs at once |
| `SELF_DEPENDENCY` | 400 | `{ taskId }` |
| `TASK_NOT_FOUND` | 404 | `{ id }` |
| `ROUTE_NOT_FOUND` | 404 | — |
| `DUPLICATE_TASK_ID` | 409 | `{ id }` |
| `DEPENDENCY_CONFLICT` | 409 | `{ taskId, dependentIds }` — which tasks block the delete |
| `CYCLE_DETECTED` | 409 | `{ cyclePath }` — the actual loop |
| `INTERNAL_ERROR` | 500 | opaque (see [security note](#unknown-errors-are-masked)) |

### Try it

```bash
curl localhost:4000/tasks/plan | jq

# Force a cycle -> 409 with the exact loop
curl -X PUT localhost:4000/tasks/T2 -H 'Content-Type: application/json' \
  -d '{"dependencies":["T5"]}'
curl localhost:4000/tasks/plan | jq

# Recover
curl -X PUT localhost:4000/tasks/T2 -H 'Content-Type: application/json' \
  -d '{"dependencies":["T1"]}'
```

---

## How the execution planning logic works

> `backend/src/services/planner.service.ts` · tested in `backend/tests/planner.service.test.ts` (48 specs)

### 1. Why this is a graph problem

Tasks are **nodes**. "T2 depends on T1" is a **directed edge T1 → T2** ("T1 must come before T2"). The task set is a directed graph.

A valid execution plan exists **if and only if** that graph is a **DAG** — a Directed Acyclic Graph. A cycle means a set of tasks each waiting on another, so none can ever start. There is no ordering that satisfies the constraints, and the correct response is to **refuse** rather than to invent one.

Producing an ordering where every edge points forwards is, by definition, a **topological sort**.

### 2. Edge direction — the inversion

The `Task` model stores dependencies on the **dependent**, pointing **backwards**:

```
T2.dependencies = ['T1']        // "I am waiting for T1"
```

But the algorithm needs to traverse **forwards** — when T1 completes, what does that unblock?

```
adjacency['T1'] = ['T2']        // "finishing me unblocks T2"
```

So graph construction **inverts** the stored edges. Get this backwards and the plan comes out reversed while the code looks entirely correct. This inversion is the whole of `buildGraph`, and it's O(V + E) — one pass to seed the nodes, one over all edges.

### 3. Why Kahn's algorithm and not DFS

Both DFS-based topological sort and Kahn's produce a **valid** order. Only Kahn's produces the order this brief asks for.

The brief doesn't just want *a* valid order — it wants a **deterministic** one, chosen by business rules:

> *"If multiple tasks are available to be executed at the same time, the system should choose the next task using... priority and estimated effort."*

**"Multiple tasks available at the same time" is precisely Kahn's ready set** — the nodes whose in-degree has reached zero. Kahn's materialises that set *explicitly* at every step, which makes it the natural place to apply a selection rule.

DFS buries the choice in recursion order. You'd be selecting the next task by whatever order you happened to iterate the node list — arbitrary — and imposing business rules on it means fighting the algorithm's structure.

**Kahn's doesn't just *solve* the problem: its intermediate state *is* the thing the business rules operate on.** That alignment is the reason for the choice.

### 4. The algorithm

```
1. Build adjacency (inverting edges) and in-degree counts.
2. ready = every task with in-degree 0.
3. While ready is non-empty:
     a. SELECT the best ready task via the comparator.   ← the business rules
     b. Emit it.
     c. Decrement the in-degree of everything it unblocks.
     d. Anything that reaches 0 joins ready.
4. If emitted < total, a cycle blocked the rest.
```

Step **3a** is where this assignment lives. Textbook Kahn's uses a FIFO queue and takes whatever comes out — a valid order, but an arbitrary one. Replacing *"whatever comes out"* with *"the best one per the business rules"* is the entire difference between a correct answer and a complete one.

### 5. The comparator — correctness vs determinism

```typescript
export function compareTasks(a: Task, b: Task): number {
  // Rule 1: higher priority first
  const priorityDelta = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (priorityDelta !== 0) return priorityDelta;

  // Rule 2: same priority -> lower effort first
  const effortDelta = a.estimatedEffort - b.estimatedEffort;
  if (effortDelta !== 0) return effortDelta;

  // Rule 3: still tied -> task ID
  return a.id.localeCompare(b.id);
}
```

The separation is clean:

- **Kahn's guarantees correctness** — the graph constrains *which* tasks are eligible.
- **The comparator supplies determinism** — it picks *one* from among the eligible.

The comparator **cannot produce an invalid plan** — it only ever chooses from a set the graph has already blessed. That's why the ordering rules could change completely (add a due date, weight by category) without touching the sort.

**Why `PRIORITY_RANK` and not string comparison:** `Priority` is a string union, and lexicographically `'High' < 'Low' < 'Medium'` — **Low would rank above Medium.** Silently, plausibly, and wrongly. The numeric rank makes the order explicit. There is a test asserting priorities are *not* sorted alphabetically.

**Why rule 3 is not optional:** without a *total* tie-breaker, two tasks identical in priority and effort have no defined relative order — the result would depend on iteration order, an implementation detail. The same input could produce different plans across runs. The brief asks for a *"deterministic and well-reasoned order"*; the ID comparison is what makes it deterministic. It's arbitrary, but **consistently** arbitrary, and that's the whole requirement.

### 6. Worked example — the brief's Example 2

```
Task  Title              Priority  Effort  Depends on
T1    Setup project      High      2       —
T2    Create login API   High      5       T1
T3    Create dashboard   Medium    3       T1
T4    Write unit tests   High      2       T1
```

**Build the graph (inverting):**

```
adjacency:  T1 -> [T2, T3, T4]
inDegree:   T1=0, T2=1, T3=1, T4=1
```

**Run Kahn's:**

```
ready = [T1]                          only in-degree 0
  → emit T1. Decrement T2, T3, T4 → all reach 0 → all join ready.

ready = [T2, T3, T4]                  ← THE READY SET. The rules apply HERE.
    T2: High(rank 0), effort 5
    T3: Medium(rank 1), effort 3
    T4: High(rank 0), effort 2
  Rule 1 (priority): T2 and T4 tie at rank 0. T3 loses.
  Rule 2 (effort):   T4 (2) < T2 (5).
  → emit T4.

ready = [T2, T3]
  Rule 1: T2 High(0) beats T3 Medium(1).
  (T3 has LOWER effort — doesn't matter. Rule 1 runs before rule 2.)
  → emit T2.

ready = [T3]
  → emit T3.
```

**Plan: `T1 → T4 → T2 → T3`** ✓ exactly what the brief specifies.

**Waves:** T1 = 1; T2, T3, T4 = 2.

This scenario is encoded verbatim as a test suite (`Brief Example 2 — multiple available tasks`), including a spec that specifically pins *priority beats effort* rather than the other way round.

### 7. Cycle detection is free

There is **no separate cycle detector**. If Kahn's terminates having emitted fewer tasks than exist, the remainder have in-degree > 0 and no way to reach zero — they're in a cycle, or blocked behind one.

```
emitted < total   ⟺   a cycle exists
```

That's the entire check.

**Path recovery.** Knowing a cycle *exists* isn't actionable. So we then run a short DFS over **only the unresolved nodes**, colouring them white/grey/black. Reaching a **grey** node means it's already on the current path — we've closed a loop, and we slice the path from that node's first occurrence.

The result is an error that reads:

> `Circular dependency detected: T2 -> T5 -> T2. No valid execution plan exists.`

…and a UI that renders the loop, names the exact edge to cut, and gives you a button to fix it. **That gap — between "a cycle exists" and "cut this edge" — is worth fifteen lines.**

**The DFS is iterative, not recursive.** A recursive DFS on a long dependency chain would blow the call stack (Node's default is ~10k frames). A 20,000-task chain would *crash the process* rather than return an error, and an unhandled `RangeError` is a far worse failure than a slow response. There's a test with a 5,000-node chain proving it holds.

### 8. Waves — making the algorithm visible

```
wave(task) = 1                                    if no prerequisites
wave(task) = 1 + max(wave(p)) over prerequisites  otherwise
```

Tasks in the same wave are **mutually independent** — all their prerequisites are satisfied by earlier waves, and none depends on another in the same wave. With N engineers, a whole wave could be worked in parallel.

**The waves *are* Kahn's successive ready-sets.** Rendering them is rendering the algorithm's intermediate state — which is why the UI defaults to the wave view. A flat numbered list shows the **answer**; the waves show the **reasoning**.

Computed as a single DP pass *along the topological order we already have* — because `sorted` is topologically ordered, every prerequisite is guaranteed already processed when we reach a task. No second traversal, no memoisation, no recursion. O(V + E).

### 9. Critical path

```
cost(task)    = effort(task) + max(cost(p)) over prerequisites p
critical path = max over all tasks
```

- **`totalEffort`** = completion time with **one** engineer.
- **`criticalPathEffort`** = the floor with **unlimited** engineers. No amount of staffing beats it, because those tasks must happen in sequence.

The gap between them is the theoretical value of parallelising. **If they're equal, the graph is a pure chain and adding people does nothing** — a genuinely useful fact that's invisible from a list. Same DP trick, essentially free.

### 10. Complexity

| Step | Complexity |
|---|---|
| `buildGraph` | **O(V + E)** — every node once, every edge once |
| `kahnsSort` | **O(V² + E)** — see below |
| `findCyclePath` | **O(V + E)** — one DFS |
| `computeWaves`, `computeCriticalPath` | **O(V + E)** each |
| **Total** | **O(V² + E)** time, **O(V + E)** space |

**The V² term, and why I accepted it.** Selecting the best task from the ready set is a **linear scan** — O(k) where k = |ready set|. Across V iterations that's O(V²) worst case (V independent tasks, all ready at once).

A **binary min-heap** keyed on the comparator would give **O(V log V + E)**. I chose the linear scan deliberately:

- **V here is a sprint backlog** — tens, maybe low hundreds. At V=200, V² is 40,000 comparisons: microseconds. The difference is unmeasurable.
- **The scan is six obvious lines.** A hand-rolled heap is ~50 lines of sift-up/sift-down that a reviewer has to verify, and it would obscure the part of the code that actually matters — the comparator.
- **The swap is fully localised.** Only `selectNext` changes. Nothing else in the class knows how the ready set is stored.

This is a conscious readability-over-asymptotics call at a scale where asymptotics don't bite. If the graph grew to tens of thousands of nodes, the heap goes in that one method and nowhere else.

**Why the repository's `Map` matters here:** graph construction resolves every dependency ID to a task. With a `Map` that's O(1) each. With an array-backed store it'd be an O(V) scan, and nested inside the edge loop, construction would degrade to **O(V·E)**. The data-structure choice at the *storage* layer is what makes the complexity claim at the *service* layer true.

---

## Assumptions

The brief doesn't specify these. Each was a decision.

1. **`Done` tasks are excluded from the plan but still satisfy dependencies.**
   A plan is "what to do next," so finished work doesn't belong in it. But a task whose only prerequisite is `Done` must be **immediately ready**. Concretely, `buildGraph` skips the edge entirely — no adjacency entry, no in-degree increment. *If you left the edge in, the dependent would wait forever on a task that's never emitted, and Kahn's would report a **phantom cycle** on a perfectly acyclic graph.*

2. **A cycle fails the *whole* plan, even if part of the graph is healthy.**
   A partial plan would be actively misleading — a complete-looking list that silently omits work the user has. They'd work through it, finish, and discover four tasks were never scheduled. Refusing is the honest answer, and the error names exactly which tasks are cyclic.

3. **Cycle-creating writes are *permitted*; plan generation is what refuses.**
   See [trade-offs](#4-cycles-are-caught-at-plan-time-not-write-time).

4. **Deleting a task that others depend on is *blocked* (409), not cascaded or orphaned.**
   See [trade-offs](#3-delete-blocks-it-doesnt-cascade-or-orphan).

5. **Task IDs are client-supplied strings, defaulting to `T1`, `T2`, …**
   The brief's examples use these, and a plan reading `T1 → T4 → T2` is legible in a way a list of UUIDs isn't. Duplicates are rejected with a 409.

6. **The plan is computed over *all* tasks, ignoring query filters.**
   A dependency graph is only correct as a whole. Filter out a Low-priority prerequisite and its dependents become **false roots** — the plan would place them at wave 1 and claim they're ready, when they're blocked by work the filter hid. That's not a partial plan; **it's a wrong plan that looks authoritative.**

7. **Single-user.** No auth, no concurrency control, no cross-tab sync.

---

## Design decisions and trade-offs

### 1. Validation is split in two, and the split is the point

- **Structural** validation is Zod at the boundary — is `priority` one of three strings, is `estimatedEffort` positive, are there duplicate dependency IDs. It's a **pure function of the payload**.
- **Semantic** validation is in the service — does dependency `T9` exist, is this a self-dependency, is this ID taken, would this delete orphan someone. Every one of those **requires reading the store**.

Putting the semantic checks in a schema would couple my validation layer to my persistence layer for no reason. So: schemas can't touch the repository, and the service doesn't re-check types.

### 2. Dependencies are deduplicated at the boundary — this prevents a real bug

`dependenciesSchema` strips duplicates via a Zod `.transform()`. That looks cosmetic. It isn't.

If `T5.dependencies = ['T2', 'T2']`, Kahn's increments `inDegree[T5]` **twice** — but there's only **one** real edge, so it decrements **once**. The counter never reaches zero. T5 silently drops out of the plan, `emitted < total` fires, and the user gets a **cycle error for an acyclic graph**.

Normalising at the edge makes that state *unreachable*. The principle: **push invariants to the boundary so the core can assume them.**

This is also why the validation middleware **writes the parsed value back** onto the request (`req[part] = result.data`). Discarding Zod's output and reading the raw body would throw away every transform — and the dedupe would silently never happen.

### 3. Delete blocks. It doesn't cascade or orphan.

| Option | What happens | Verdict |
|---|---|---|
| **Cascade** | Delete T1 → also delete T2, T3 | Destructive and surprising. A user deleting one task silently loses three. |
| **Orphan** | Delete T1 → T2 still lists `['T1']` | Dangling reference. Every *subsequent* plan request fails with `UNKNOWN_DEPENDENCY` — the error surfaces later, somewhere else, and looks unrelated to what the user did. |
| **Block** ✅ | Delete T1 → **409, listing T2 and T3** | Fails immediately, **at the point of the action**, destroying nothing. The recovery path is explicit and the error payload tells the UI exactly what to say. |

Blocking is the only option where the error arrives *where the user can act on it*.

### 4. Cycles are caught at plan time, not write time

This looks like a gap. It's a choice.

Consider reversing a dependency: T2 depends on T1, and you want T1 to depend on T2 instead. To get there you must pass through a state with **both** edges (a cycle) or **neither**. If I reject every cycle-creating write, the first path is banned and the editor fights the user.

Deferring the check to plan generation means the graph is **freely editable**, and the guarantee that actually matters — *no invalid plan is ever produced* — is still absolute, because the planner refuses. Editing freedom at zero cost to correctness.

**The counter-argument is real:** rejecting at write time gives faster feedback and keeps the store always-valid. I'd change my mind if the product had a strong "the store must never be inconsistent" requirement.

**The UI closes the gap anyway.** `cycle.utils.ts` predicts, client-side, which dependencies *would* create a cycle — a BFS forward from the task being edited — and renders those options **disabled, with the reason**. *(Note: that's the same edge inversion as `buildGraph`. Same problem, same answer, different layer.)* The user never creates the bad state. **The client is a hint; the server is the truth.**

### 5. One error exit point

Services throw `AppError`, which carries its own `code`, `statusCode`, and `details`. **Exactly one place** — the error middleware — maps a domain error onto an HTTP status. "A cycle is a 409" is written down *once*, in `AppError.cycleDetected`.

The payoff: `plan.controller.ts` is **four lines** and contains **zero** cycle-specific code. `next(error)` is sufficient. A new failure mode costs a factory method, not a new branch in every handler.

### <a name="unknown-errors-are-masked"></a>6. Unknown errors are masked — a security decision, not a formatting one

An `AppError` is a failure we *anticipated*; its message was written **for the user** and is safe. Anything else — a `TypeError`, a null dereference — is a **bug**, and its message may carry a file path, a stack frame, or internal state. Echoing it is information disclosure.

So: unknown errors are **logged server-side in full** and returned as an **opaque 500**. There's a test asserting the internal message doesn't appear in the response body — because otherwise someone adds `message: error.message` while debugging and never removes it.

### 7. Strict bodies, lenient query strings

`updateTaskSchema` is `.strict()` — an unknown key is a 400. `taskQuerySchema` is not — unknown params are ignored.

Deliberate asymmetry. A request **body** is a structured payload the client built on purpose; an unexpected key means confusion and should be reported. A **query string** is a promiscuous public surface — analytics params and link trackers get appended routinely, through no fault of the client. Strictness there would break real requests to enforce a rule that protects nothing.

### 8. The repository is a seam, not just a `Map`

Everything above depends on the `ITaskRepository` **interface**, never on `InMemoryTaskRepository`. `repositories/index.ts` is the single file naming a concrete implementation.

Swapping to Postgres = write `PostgresTaskRepository`, change **one line**. No service, controller, or test changes. *That's the actual thing the "in-memory only" constraint is testing* — whether you build a swappable data layer or scatter an array across your controllers.

Reads return **copies**, never live references. Without that, `repo.findById('T1').dependencies.push('T9')` would silently corrupt the store, and the repository's whole contract — "I own this data" — would be a fiction. Four tests prove external mutation can't reach the store.

### 9. `route order` is load-bearing

`GET /tasks/plan` **must** be registered before `GET /tasks/:id`. Express matches top-down, and `/:id` is a wildcard that matches the literal string `plan` — so if it came first, the plan endpoint would return *"Task 'plan' does not exist"* and be silently unreachable.

It's a one-line fix that costs an hour to find. There's an integration test (`resolves GET /tasks/plan to the PLANNER, not to :id`) that would fail if anyone reordered the file — because **no unit test would catch it.**

### 10. Filtering is client-side in the UI, but server-side in the API

The backend supports `?search=&priority=&…`, and the UI **doesn't use it**.

The whole task set is already in memory — a sprint backlog is tens of tasks. Round-tripping to filter data the client is *holding* costs ~50ms per keystroke for something that takes microseconds locally, and it would force debouncing, cancellation, and out-of-order-response handling — machinery to make the experience *worse*.

The server-side filter isn't dead code: it's the **API being correct independently of one client** (a CLI, a dashboard querying 10k tasks), and it's the **migration path**. When the dataset outgrows the client, the change is `loadTasks(filters)` instead of a `useMemo`, and the server is already ready. **The line moves with the data size; the API shouldn't have to.**

### 11. `planStale` — a stale plan in a planning tool is a correctness bug

The plan is *derived* from the tasks and computed *server-side*. Any mutation can reorder it, break it into a cycle, or fix one.

Every **successful** mutation sets `planStale: true`; the plan page refetches when it sees it. Note what *doesn't* set it: a **failed** operation. A rejected delete changed nothing, so invalidating would trigger a refetch returning the identical answer.

And it **marks** rather than eagerly refetching — a user creating five tasks in a row triggers **one** plan fetch, not five.

### 12. Types are duplicated between frontend and backend

~30 lines, hand-synced, and nothing but discipline keeps them aligned. The proper fixes, in order of rigour:

1. **Generate the client from an OpenAPI spec** — the *contract* becomes the source of truth, not either codebase. Best answer, and what I'd do in a real service.
2. Extract a shared workspace package both import.

I did neither: a monorepo workspace for six type declarations is build tooling I'd have to justify and a reviewer would have to set up before they could run anything. **Named as a trade-off, not hidden.**

---

## Testing

```bash
cd backend && npm test
```

```
✓ tests/planner.service.test.ts    (48)   ← the core
✓ tests/app.routes.test.ts         (26)   ← HTTP integration, incl. the route trap
✓ tests/task.service.test.ts       (31)
✓ tests/task.schema.test.ts        (20)
✓ tests/task.repository.test.ts    (16)
✓ tests/error-handler.test.ts       (9)
✓ tests/validate.middleware.test.ts (8)
✓ tests/seed.test.ts                (5)

Test Files  8 passed (8)
     Tests  163 passed (163)
```

**Testing effort is concentrated where the logic risk is.** The planner carries the most weight and gets the most coverage.

**The brief's three examples are encoded verbatim as the first three suites** of `planner.service.test.ts`. They *are* the specification:

```
Brief Example 1 — simple dependency chain     (2 specs)
Brief Example 2 — multiple available tasks    (4 specs)
Brief Example 3 — circular dependency         (4 specs)
```

Specs worth calling out, because each documents a bug that *doesn't exist because it was prevented*:

- **`does NOT rank priorities alphabetically`** — pins the entire reason `PRIORITY_RANK` exists.
- **`prefers T2 over T3 — higher priority beats lower effort`** — pins rule *precedence*.
- **`handles a deep chain without stack overflow`** (5,000 nodes) — pins the iterative DFS.
- **`treats a Done dependency as satisfied, not as a blocker`** — pins the phantom-cycle fix.
- **`throws UNKNOWN_DEPENDENCY, not a cycle, for a missing reference`** — refuses to silently drop a dangling edge, which would produce a plan that *looks valid while ignoring a real constraint*.
- **`DEDUPLICATES the dependency array`** — pins the phantom-cycle prevention.
- **`does not leak the internal message`** — a security regression test.
- **`resolves GET /tasks/plan to the PLANNER, not to :id`** — the routing trap; **no unit test would catch this.**
- **Determinism suite** — same input, same plan, 20 runs, any input array order.

**Not tested:** the React components. Testing effort went to the backend, where the algorithmic risk is. With more time I'd add React Testing Library specs for the dependency selector's cycle prediction and the form's error mapping.

---

## Limitations and future work

**Named honestly rather than hidden.**

### Inherent to the in-memory constraint

- **Data resets on restart.** Required by the brief.
- **Two instances behind a load balancer would diverge** — each process has its own `Map`. Fixed by any shared store; the repository seam is where it plugs in.

### Known gaps

| Gap | Fix | Why I didn't |
|---|---|---|
| **Last-write-wins on concurrent edits.** Two users editing the same task silently overwrite each other. | Optimistic concurrency: a `version` field, incremented on write, with the server rejecting a mismatch (409). | Out of scope for single-user. **I'd add it the moment this had two users.** |
| **No unsaved-changes guard.** Escape on a half-filled form discards it. | Track dirty state, intercept close. ~15 lines. | Chose to spend the time on this README, which is worth more rubric points. |
| **No React error boundary.** A render crash white-screens the app. | ~20 lines. | Same. **First thing I'd add with another hour.** |
| **No frontend tests.** | React Testing Library on the cycle predictor and the form's server-error mapping. | Concentrated testing where the logic risk is. |
| **No virtualisation.** ~10k tasks would choke the DOM. | `react-window`. | A sprint backlog is tens of tasks. Note that client-side *filtering* breaks before rendering does — at that scale I'd move filtering server-side first. |
| **Context re-renders every consumer** on any state change. | Zustand, for slice-level subscriptions. | Genuinely fine at this size. **This is the exact boundary where I'd switch.** |
| **Only one cycle is reported** when several exist. | Tarjan's strongly-connected components — O(V + E). | One actionable cycle is enough; the user fixes it and re-runs. Reporting six is noise. |
| **O(V²) ready-set selection.** | Binary min-heap → O(V log V + E). Drops into `selectNext` alone. | See [complexity](#10-complexity). Deliberate. |

### If this went to production

`helmet`, rate limiting on writes, a request-ID middleware so a client-visible error correlates to a server log line, and structured logging (`pino`) instead of `console.error`. None of them change the architecture — they're all `app.use` lines in `createApp`, which is itself an argument for having a proper composition root.

---

## What I'd want you to look at first

1. **`backend/src/services/planner.service.ts`** — the graph, Kahn's, the comparator, the cycle-path DFS. The header docblock is the design document.
2. **`backend/tests/planner.service.test.ts`** — the brief's three examples, encoded verbatim as the first three suites.
3. **The plan page, in wave view** — the waves *are* Kahn's ready-sets, rendered. Each entry shows *why* it was chosen over the others that were ready at the same moment.
4. **Force a cycle** (`curl -X PUT localhost:4000/tasks/T2 -d '{"dependencies":["T5"]}'`) and reload the plan. The backend's DFS output becomes a rendered loop, a named edge to cut, and a one-click fix.
