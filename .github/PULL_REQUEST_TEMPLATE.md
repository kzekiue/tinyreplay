<!--
PR title must follow Conventional Commits, e.g. "fix: handle empty ingest batch".
Branch name must be <type>/<short-desc>, e.g. fix/ingest-timeout.
Allowed types: feat, fix, docs, ci, chore, refactor, test, perf, build, style, revert.
The "PR conventions" check enforces both.
-->

## What & why

<!-- What does this change and why? -->

Closes #

## Checklist

- [ ] In scope (session replay only, see CONTRIBUTING.md)
- [ ] `npm run check` passes (lint, prose, build, typecheck, tests)
- [ ] Privacy defaults unchanged (or the change is intentional and documented)
- [ ] No new outbound network calls (or the file carries a `// NO TELEMETRY` note)
- [ ] PR title is Conventional Commits and the branch is `<type>/<short-desc>`
