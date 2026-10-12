# ENGUI-549 - W14: Production cutover, verification and rollback

Status: Done
Created: 2026-10-12
Completed: 2026-10-12
Labels: [workspaces, backend, frontend, mobile]

## Summary

Implement W14 from [the detailed plan](../../docs/workspace-isolation-implementation-plan.md) in accordance with [the specification](../../docs/workspace-isolation-spec.md).

## Acceptance Criteria

- [x] Complete all W14 tasks and its documented acceptance criteria.
- [x] Record meaningful validation and preservation evidence.
- [x] Do not modify unrelated files or data.

## Implementation notes

Application release `df4f659` was built in the production repository and deployed at 20:10 UTC. Migration `20261012-workspace-isolation-v1` preserves all 42 original tables; the deployed original protected Default contains 8,793 gallery records and 88 LoRAs. Settings/content metadata and sample original bytes match the fresh backup. SQLite, desktop/mobile pages, scoped content APIs and service health passed.

The user explicitly accepted same-disk backup and separately authorized removal of one unreadable PNG and its gallery record. Its metadata/readable derivatives are retained privately. No other content was intentionally removed; no paid generation tests were launched.

Automatic rollback was exercised successfully after an earlier pre-reopen build-permission failure. The corrected final cutover exited 0. Existing unrelated `tmp/` was preserved.

See [validation and release evidence](../../docs/workspace-isolation-validation.md) for checks, limitations, backup paths and rollback details.
