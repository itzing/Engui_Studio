---
id: ENGUI-595
title: Batch Cards JSON import, generation review and Pick export
status: In Progress
assignee: []
created_date: '2026-11-22 18:36'
labels: [gallery, generation, batch, cards]
dependencies: []
---

## Description
Owner14648 requests a separate batch generation screen from flat JSON rows grouped into cards with 3–5 prompt variants. Show card name/effect/class icon, variant route and generated image; support generating/regenerating one or many variants, one Pick per card, ready/unready filter, title clipboard, scoped one-card replacement and export preserving the source schema with current pick values.

## Implementation plan
Workspace-persistent batches + dedicated generation tasks, using the existing image submission and supervisor. Settings per batch; defaults configurable. Strict atomic import validation and preserved extra source fields. Card replacement increments revision and invalidates its result links/Pick, preventing old task results from leaking back. Selection for generation is separate from Pick. Idempotent queue requests and lease/provider acceptance tracking survive browser/server restarts without auto-resubmitting ambiguous requests.

## Acceptance
- [x] Import/group 3–5 variants with actionable validation and lossless export.
- [x] Card grid/navigation/search/class/ready filters, copy title, image/prompt review and Pick.
- [x] One/multiple variant generation and safe per-card replacement.
- [x] Workspace persistence/isolation, durable tasks, idempotency and stale-result rejection.
- [x] Isolated service/unit/browser tests; no paid generations.
- [ ] Additive migration with DB backup, isolated production build, commit/push/deploy and health checks.

## Rollback
Retain previous .next and pre-migration SQLite backup in the task run directory. Added tables are compatible with the previous application; prefer reverting the build over overwriting a DB with newer job activity.

## Pre-deploy validation
- 16 unit/service/API checks passed on isolated SQLite with a fake provider and blocked network.
- 40 browser checks passed (20 Chromium + 20 WebKit), all API writes mocked.
- Production candidate `Tf3mvqSQ7PWlFuQYvOhgm`; additive migration rehearsed on snapshot, integrity OK, zero foreign-key violations.
- Existing repository-wide TypeScript diagnostics remain; no diagnostics in changed source or new tests.
