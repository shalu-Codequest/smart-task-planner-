# Architecture Notes

A one-page companion to the README. The README explains *what*; this explains
*the shape*.

## The dependency rule

Dependencies point **inward and downward only**.

```
routes -> controllers -> services -> repositories
              |             |             |
              v             v             v
          (express)    (no express)   (the Map)
```

- A controller may import a service. A service may import a repository.
- **A repository never imports a service.**
- **Nothing below `controllers/` ever imports Express.**

That last rule is what makes `planner.service.ts` a pure, testable function of
its inputs — which is exactly what the DSA score depends on. It takes `Task[]`
and returns `ExecutionPlan`. No mocks, no stubs, no fixtures, no server.

## The three seams

**1. `ITaskRepository`** — the storage seam.
Everything above depends on the interface. `repositories/index.ts` is the only
file naming a concrete implementation. Swapping to Postgres is a one-line change
there.

**2. `AppError` + the error middleware** — the transport seam.
Services throw domain errors carrying their own code, status, and details. One
middleware maps them to HTTP. The service layer has no idea what a status code
is, so it could be driven from a CLI or a queue consumer unchanged.

**3. `createApp()` vs `server.ts`** — the side-effect seam.
`createApp()` returns a wired Express instance and binds no port. `server.ts` is
the only thing with a side effect. That split is why the integration tests run
in-process with no socket, no port conflicts, and no async teardown.

## Where the complexity claims come from

The planner claims O(V + E) graph construction. That's only true because the
repository is a `Map`.

```
buildGraph resolves every dependency ID -> Task.
  With a Map:    O(1) per lookup   -> O(V + E) construction
  With an array: O(V) per lookup   -> O(V * E) construction
```

The data-structure choice at the **storage** layer is what makes the algorithmic
claim at the **service** layer true. They aren't independent decisions.

## The edge inversion, three times

The `Task` model stores dependencies **backwards** — on the dependent, pointing
at its prerequisites. Three separate places need to walk **forwards**, and all
three perform the same inversion:

| Where | Question it answers |
|---|---|
| `planner.service.ts` → `buildGraph` | "When T1 finishes, what does it unblock?" |
| `TaskDetail.tsx` → the "Blocks" list | "What does finishing this task unblock?" |
| `cycle.utils.ts` → `findForbiddenDependencies` | "Which tasks are downstream of me, and therefore illegal as dependencies?" |

Same problem, same answer, three layers. The graph thinking isn't confined to the
file that demanded it.

## Frontend layering

```
Component
   | useTasks()
TaskContext (useReducer)     <- single source of truth
   | api/tasks.api.ts
api/client.ts (Axios)        <- the ONLY file that knows HTTP exists
   |
Backend
   | { error: { code, message, details } }
ApiError                     <- the only error type the UI ever handles
```

Containers (`pages/`) own the data connection and view state. Components are
**pure functions of their props** — they don't fetch, don't touch the context, and
hold no state. That's why a card renders identically wherever it's put, and why
there's no chance of one card having a different idea of the data than another.
