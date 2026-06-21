# Security Policy

## Reporting a vulnerability

Please report security issues privately via GitHub's
[private vulnerability reporting](https://github.com/kzekiue/tinyreplay/security/advisories/new)
(Security → Report a vulnerability) rather than opening a public issue.

We aim to acknowledge reports within a few days. There is no bug bounty -
TinyReplay is a small open-source project.

## Scope And Assumptions

TinyReplay is **self-hosted**: you run the server and own the data. There is no
TinyReplay-operated service and the SDK sends data only to your own `endpoint`
([No telemetry](packages/sdk/src/transport.ts)).

Security-relevant defaults:

- **PII masking is on at capture time.** `maskAllInputs` is the default; text
  masking (`data-tr-mask`) and blocking (`data-tr-ignore`) happen in rrweb
  before any event is serialized. Network capture is **metadata only** (method,
  URL, status, duration) - never headers or bodies.
- **The dashboard is unauthenticated by default.** Set `DASHBOARD_PASSWORD`
  (HTTP Basic) and `INGEST_TOKEN` before exposing an instance publicly, and put
  it behind TLS / a reverse proxy. Token checks are constant-time.
- **Ingest is rate-limited and size-capped** (`RATE_LIMIT_PER_MIN`,
  `MAX_PAYLOAD_BYTES`). All ingest input is validated with zod; all SQL is
  parameterized.

If you deploy a public instance without `DASHBOARD_PASSWORD`/`INGEST_TOKEN`,
that is a configuration choice, not a vulnerability.

## Supported versions

TinyReplay is pre-1.0. Only the latest release receives fixes.
