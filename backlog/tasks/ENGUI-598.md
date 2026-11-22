---
id: ENGUI-598
title: Delete and replace entire Batch Cards batches
status: Done
created_date: '2026-11-22 19:36'
labels: [batch, cards, lifecycle]
---

## Request
Owner14687: delete existing batches or overwrite them with new JSON; replacement invalidates every generation and Pick.

## Design and acceptance
- Explicit Replace batch JSON and Delete batch controls with named confirmation. Keep title/settings on overwrite; validate entire JSON before atomic replacement. Ignore imported Picks on overwrite. Clear all current task links and generation selections, update navigation/counts.
- Cancel queued and not-yet-submitted preparation tasks. Submitted attempts retain provider/history evidence and cannot reattach late results. No paid generations in tests.
- Soft-delete via nullable deletedAt: disappear from list, detail/export/mutations return 404, retain jobs/submission evidence and originals. Existing historical output files are not destructively erased.
- Revision-checked mutations and workspace isolation. Invalid data/stale confirmation never overwrites a newer batch. Stale polling cannot resurrect deleted UI.
- Service tests for replacement/deletion during dispatch and late completion; browser checks for confirmation/cancel/validation/reset/last-batch empty state.
- Additive migration with online backup, isolated build then commit/push/promote/restart; old build retained. No existing user batch deleted/replaced as a test.

## Validation
34 isolated tests pass, including atomic/stale replacement, preserved settings, full Pick reset, late completion, pre/post-provider-boundary deletion and workspace/revision API checks. Production build succeeds; no type diagnostics in changed files (repository retains pre-existing tsc failures). Additive migration rehearsed against a private online snapshot with row counts, integrity and foreign keys verified. Chromium + WebKit: 64 workflow checks passed, including named confirmations/cancel, invalid/stale/error replacement, full reset/reload, failed-delete retry, switching to another batch and stable last-batch empty state.

## Release
Commit 8b495a3 pushed under owner identity. Additive nullable deletion marker migrated with online backup; integrity and foreign keys verified. Build ac7T3FpMSgDcuuKnZ7y3h deployed 2026-11-22 19:42 UTC, service active. Root/Batch Cards/mobile smoke routes 200; scoped list/detail API verified directly and through Tailscale HTTPS, missing batch404. No live user batch replaced or deleted during tests. Previous build FDg0pH981SF-1C-MXvXJS and private DB backup retained in engui-runs/engui-598-20261122. Full evidence in workspace runs/engui-598-20261122.
