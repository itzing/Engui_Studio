# ENGUI-536 - W01: Inventory, preservation manifest and backup rehearsal

Status: Done
Created: 2026-10-12
Labels: [workspaces, backend, frontend, mobile]

## Summary

Implement W01 from [the detailed plan](../../docs/workspace-isolation-implementation-plan.md) in accordance with [the specification](../../docs/workspace-isolation-spec.md).

## Scope and dependencies

Follow the complete tasks, dependency graph and exit gate of W01 in the plan. Preserve existing Default identity/content and shared global configuration. Do not launch paid generation runs.

## Acceptance Criteria

- [x] Complete all W01 tasks and its documented acceptance criteria.
- [x] Record meaningful validation and preservation evidence.
- [x] Do not modify unrelated files or data.

## Implementation notes

Implementation started in isolated worktree /home/engui/worktrees/workspace-isolation, branch feat/workspace-isolation. Production checkout/runtime/database were not changed.

Backup run: /home/engui/backups/workspaces-20261012 (private directory). The SQLite snapshot passed quick_check. Media copying failed on an existing gallery PNG with EIO. A separate full read reproduced errno 5; kernel reports NVMe critical medium error at sector 513071872 on nvme1n1.

Affected original: public/generations/gallery/214653b8-0416-447a-bdfd-22e00785bedd/2bd4b7e36d5b28b7b910d66b299e468c16aa7e4f3a6fcd415dc795aa02534731.png
Asset ID: aa11ed99-777d-4554-8178-1ac95098b206.
No same-size original duplicate found in current generation directories. Preview (117560 bytes) and thumbnail (27768 bytes) read successfully. Do not replace the original with a lower-resolution derivative silently.

The local backup resides on the SAME physical NVMe and is not protection against device failure. A second physical NVMe contains unmounted NTFS/Windows partitions; do not mount/write it without an explicit destination decision.

Gate: obtain an independent backup destination and preserve readable data before resuming migrations/builds. Do not retry mass copying/hashing or run repair/stress commands automatically. Both detached preparation/backup processes have stopped. No production migration, deployment, paid job, file deletion or workspace deletion was performed.

## 2026-10-12 resumption

The user explicitly accepted a same-disk backup and requested removal of the unreadable PNG and its gallery record. That exact asset and readable derivatives were removed after preserving its metadata/previews. The original physical-media concern remains documented; it no longer blocks the authorized local-backup workflow. Implementation continues in the isolated checkout. See docs/workspace-isolation-validation.md for current evidence.

## Completion evidence

Implemented and validated in the isolated checkout. See [validation evidence](../../docs/workspace-isolation-validation.md). The release is gated on ENGUI-549 production cutover; no paid model runs were used.
