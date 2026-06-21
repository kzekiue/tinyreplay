# Contributing

tinyreplay is small by design. Changes should keep the browser SDK isolated, the
server easy to run, and replay data under the operator's control.

## Scope

The current release is session replay only.

In scope:

- Browser SDK recording, masking, transport, and teardown.
- Server ingestion, validation, SQLite persistence, retention, and dashboard.
- Small documentation updates that match working behavior.
- Tests for risky behavior.

Out of scope:

- Funnels, heatmaps, feature flags, user profiles, accounts, billing, surveys,
  hosted storage, mobile SDKs, distributed queues, Kubernetes manifests, and
  plugin systems.

Open an issue before starting work that changes public APIs, storage format,
configuration, package exports, or dashboard behavior.

## Prerequisites

- Node.js 20 or newer.
- npm 10 or newer.
- Docker, only for container changes.
- SQLite CLI, optional for manual database inspection.

## Setup

```bash
npm install
npm run build
npm run dev
```

The dashboard runs at <http://localhost:3000>.

## Checks

Run the full local gate before opening a pull request:

```bash
npm run check
```

Individual commands:

```bash
npm run check:format
npm run lint
npm run check:architecture
npm run check:dead-code
npm run check:forbidden
npm run check:secrets
npm run build
npm run test
```

## Project Structure

```txt
packages/sdk     Browser SDK. No server or Node-only imports.
apps/server      Next.js app, ingestion API, dashboard, SQLite persistence.
examples         Small runnable examples.
scripts          Repository checks used by npm run check and CI.
```

## Coding Standards

- Use strict TypeScript.
- Do not use `any`.
- Do not use unsafe casts unless the boundary is unavoidable and explained.
- Do not use `@ts-ignore`.
- Use `@ts-expect-error` only in tests that intentionally pass invalid input.
- Read `process.env` only in `apps/server/src/lib/config.ts`.
- Keep direct SQLite access in persistence modules.
- Keep route handlers thin: validate, authorize, delegate, respond.
- Do not use direct `console` in production code outside the logging boundary.
- Do not leave dead code, commented-out code, or unused exports.
- Keep comments factual and useful. Explain risk or intent, not obvious syntax.
- Do not add tool provenance, private notes, or report prose to source files.
- Do not use em dash characters in human-authored files.
- Do not create dumping-ground modules.
- Avoid premature abstractions and needless refactors.
- Do not hardcode deployment ports, origins, URLs, paths, limits, retention,
  CORS policy, log level, retry policy, timeout policy, or SDK endpoints outside
  configuration or documented constants.
- Do not put secrets in code, tests, examples, logs, or documentation.
- Do not log user payloads, session payloads, cookies, tokens, or browser
  storage.
- Do not import server code from the browser SDK.
- Do not deep-import private package internals from public API consumers.

## Testing Expectations

Add or update tests when touching:

- Ingestion validation.
- Malformed or oversized payload handling.
- SQLite schema, migrations, retention, or queries.
- Replay event retrieval.
- Masking and ignored-element behavior.
- SDK initialization, repeated initialization, teardown, and network failure.
- Dashboard empty and error states.
- Public package exports.

Avoid tests that only lock down private line-by-line structure.

## Security And Privacy

- Masking must happen in the browser before events are serialized.
- Passwords and sensitive inputs must remain masked by default.
- Network capture must stay metadata-only.
- CORS must be explicit and configurable.
- Payload sizes and ingest rate must stay bounded.
- SQL must stay parameterized.
- Errors returned to clients must not expose stack traces, SQL, paths, secrets,
  or replay payloads.

Report vulnerabilities using the process in [SECURITY.md](./SECURITY.md).

## Dependencies

- Prefer the platform and existing dependencies.
- Add a dependency only when it removes real maintenance burden.
- Keep runtime dependencies out of the SDK unless they are required in the
  browser bundle.
- Do not add outbound services to the SDK or server.
- Update the lockfile with `npm install` when dependency metadata changes.

## Branches, Commits, and PR Titles

Branch names, PR titles, and commit subjects follow one convention so history
and tooling stay clean. The `PR conventions` check enforces the branch name and
PR title on every pull request.

Allowed types: `feat`, `fix`, `docs`, `ci`, `chore`, `refactor`, `test`,
`perf`, `build`, `style`, `revert`.

- **Branch:** `<type>/<short-desc>`, lowercase and dash-separated. Examples:
  `fix/ingest-timeout`, `feat/share-link`, `docs/env-vars`.
- **PR title and commit subject:** Conventional Commits,
  `<type>(optional-scope): summary`. Examples: `fix: reject oversized batches`,
  `feat(sdk): flush on stop()`. Add `!` after the type for a breaking change.
- Keep subjects imperative and under about 72 characters.
- Do not add tool provenance or AI co-author trailers to commit messages.

## Pull Requests

Pull requests should include:

- A short description of the behavior change.
- Tests or a clear reason tests were not needed.
- Documentation updates when public behavior changes.
- Confirmation that `npm run check` passes.

Bug reports should include the tinyreplay version, deployment path, browser when
the SDK is involved, relevant configuration with secrets redacted, and steps to
reproduce.

Proposals should describe the problem, the smallest useful change, and why it
fits the current session-replay scope.

By contributing, you agree that your work is licensed under the
[MIT License](./LICENSE).
