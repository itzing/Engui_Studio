---
id: ENGUI-584
title: Implement immutable MCP generation plans and durable batches
status: Done
updated_date: '2026-11-11 20:23'
assignee: []
created_date: '2026-11-11 20:04'
labels: [mcp, backend]
dependencies: []
---

## Description

Frozen inputs, idempotency, dispatch fencing, uncertain acceptance and cancellation.

Owner14303 authorizes implementation of docs/engui-mcp-character-concepts-v1-spec.md, explicitly excluding client connection setup. Backend-only; no desktop/mobile changes. No paid generation validation.

## Acceptance Criteria

- [x] Implement the scoped specification requirements for this slice.
- [x] Validate behavior and relevant regressions without paid providers.
- [x] Document operation and evidence; commit and push under owner identity.

## Completion Notes

Immutable exact prompts/seeds, durable local receipts and composite ownership, one batch/plan, leased dispatch, no-retry provider boundary, confirmed rejection versus unknown acceptance and cancellation fence.

Runtime rollback artifact and consistent database backup: /home/engui/engui-runs/engui-mcp-20261111/. Agent evidence: runs/engui-mcp-implementation-20261111/. Publication uses Artem Ovechkin / itzing. No paid generation was launched.
