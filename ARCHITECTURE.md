# Architecture

TinyReplay is a small monorepo with three parts and a single hard rule for the
dependency direction: the browser SDK never imports server code, and the
dashboard never reaches the database except through the server's persistence
modules.

```
packages/sdk     Browser SDK. Wraps rrweb, batches events, masks input, and
                 POSTs to a TinyReplay server. No server or Node-only imports.
apps/server      Next.js app. Ingestion API + dashboard + SQLite, one process.
docs             Next.js documentation site. Deployed separately.
```

## Data flow

```
 browser page                         apps/server (one Node process)
┌───────────────┐   POST /api/ingest   ┌────────────────────────────────────────┐
│ @tinyreplay/  │ ──────────────────►  │ route -> validate -> queries -> SQLite │
│ sdk (rrweb)   │   batched JSON       │                                        │
└───────────────┘                      │ dashboard (RSC) -> queries -> SQLite   │
                                       │ replay player (client) <- events JSON  │
                                       └────────────────────────────────────────┘
```

1. The SDK records rrweb events, masks them at capture time, buffers them, and
   flushes batches to `POST /api/ingest`.
2. The ingest route validates the request (method, content type, size, rate
   limit, schema, token), then hands a typed input to the persistence layer.
3. Events are stored verbatim as JSON, grouped by session and flush sequence.
4. The dashboard reads sessions and events through the same persistence modules
   in React Server Components, and the replay player reconstructs the stream
   client-side with rrweb.

## Browser SDK (`packages/sdk`)

| Module          | Responsibility                                                       |
| --------------- | ------------------------------------------------------------------- |
| `index.ts`      | Public API (`init`, `stop`). Guards SSR and duplicate init.         |
| `recorder.ts`   | Owns the rrweb recording lifecycle, buffering, flushing, teardown.  |
| `masking.ts`    | Maps `data-tr-mask` / `data-tr-ignore` onto rrweb privacy options.  |
| `capture.ts`    | Network and error metadata capture, decoupled via `emit` callbacks. |
| `transport.ts`  | The only outbound network code: POST and `sendBeacon`, one retry.   |
| `session.ts`    | Session id generation and viewport metadata.                        |
| `types.ts`      | Wire types and the rrweb custom-event tags shared with the server.  |

The recorder is the only stateful module. Every timer, listener, and observer it
installs is released in `stop()`. Buffers, batches, and retries are bounded; the
public limits are listed in the README.

## Server (`apps/server`)

Route handlers stay thin: they validate input and delegate. Business logic and
SQL live in `lib`.

| Module             | Responsibility                                                    |
| ------------------ | ---------------------------------------------------------------- |
| `lib/config.ts`    | The single boundary for reading and parsing `process.env`.       |
| `lib/db.ts`        | SQLite connection, migrations, retention sweep, store stats.      |
| `lib/queries.ts`   | All SQL. Parameterized statements and transactions.              |
| `lib/validate.ts`  | The zod ingest schema and custom-event counting.                 |
| `lib/cors.ts`      | CORS headers derived from `ALLOWED_ORIGINS`.                     |
| `lib/auth.ts`      | Constant-time dashboard Basic-auth check (edge runtime safe).    |
| `lib/rate-limit.ts`| Per-IP, per-process token bucket.                               |
| `lib/log.ts`       | The server logging boundary.                                     |
| `middleware.ts`    | Dashboard auth gate; leaves ingest, health, and the SDK open.    |
| `app/api/*`        | `ingest`, `health`, and `sessions` route handlers.              |

Dependency direction inside the server points one way: routes and components
depend on `lib`; `lib/config.ts` is the only module that reads the environment,
and `lib/db.ts` plus `lib/queries.ts` are the only modules that touch SQLite.

## Persistence

SQLite, accessed with `better-sqlite3`, in WAL mode with foreign keys on. Three
tables: `sessions`, `events` (raw rrweb batches as JSON), and `settings`.

Migrations are an ordered list applied by `PRAGMA user_version`. On open, each
migration whose index exceeds the stored version runs in a transaction, then the
version is stamped. Shipped migrations are never edited; new schema is appended.

Retention is opt-in (`RETENTION_DAYS` or the persisted setting) and runs as an
hourly in-process sweep that does nothing when retention is off.

## Configuration

Every deployment knob is an environment variable read through `lib/config.ts`.
Values are read lazily so the running process reflects its environment and tests
can set variables per case. Every variable is optional and has a documented
default; invalid values fall back to that default. See `.env.example` and the
README configuration table for the full list.

## Errors and logging

The ingest route maps internal failures to stable public responses (`400`,
`401`, `413`, `429`, `503`) and never returns stack traces, SQL, or payloads to
the client. Server-side diagnostics go through `lib/log.ts`; session payloads
and secrets are never logged.

## Privacy invariants

Masking happens in the browser, at capture time, before any event is serialized.
`maskAllInputs` is on by default. Network capture is metadata only (method, URL,
status, duration), never headers or bodies. The SDK reports only to the
configured `endpoint` and to nowhere else.

## Constraints

Single process, SQLite only. No Postgres, Redis, queues, or horizontal scaling.
The rate limiter is per-process. Authentication is optional and basic by design;
anything stronger belongs behind a reverse proxy.
