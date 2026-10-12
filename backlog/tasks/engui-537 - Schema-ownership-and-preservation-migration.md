# ENGUI-537 - W02: Schema ownership and preservation migration

Status: Done
Created: 2026-10-12
Labels: [workspaces, backend, frontend, mobile]

## Summary

Implement W02 from [the detailed plan](../../docs/workspace-isolation-implementation-plan.md) in accordance with [the specification](../../docs/workspace-isolation-spec.md).

## Scope and dependencies

Follow the complete tasks, dependency graph and exit gate of W02 in the plan. Preserve existing Default identity/content and shared global configuration. Do not launch paid generation runs.

## Acceptance Criteria

- [x] Complete all W02 tasks and its documented acceptance criteria.
- [x] Record meaningful validation and preservation evidence.
- [x] Do not modify unrelated files or data.

## Implementation notes

Preliminary additive ownership/lifecycle Prisma schema prepared only in the isolated worktree; prisma format/validate passed. No migration runner/application code/client generation or production changes yet. Paused on the W01 physical-storage read-error gate.

## 2026-10-12 resumption

The user explicitly accepted a same-disk backup and requested removal of the unreadable PNG and its gallery record. That exact asset and readable derivatives were removed after preserving its metadata/previews. The original physical-media concern remains documented; it no longer blocks the authorized local-backup workflow. Implementation continues in the isolated checkout. See docs/workspace-isolation-validation.md for current evidence.

## Completion evidence

Implemented and validated in the isolated checkout. See [validation evidence](../../docs/workspace-isolation-validation.md). The release is gated on ENGUI-549 production cutover; no paid model runs were used.
