---
id: ENGUI-583
title: Expose scoped character libraries and bounded MCP image inspection
status: Done
updated_date: '2026-11-11 20:23'
assignee: []
created_date: '2026-11-11 20:04'
labels: [mcp, backend]
dependencies: []
---

## Description

Read tools, model capabilities, ownership checks, actual bounded image bytes.

Owner14303 authorizes implementation of docs/engui-mcp-character-concepts-v1-spec.md, explicitly excluding client connection setup. Backend-only; no desktop/mobile changes. No paid generation validation.

## Acceptance Criteria

- [x] Implement the scoped specification requirements for this slice.
- [x] Validate behavior and relevant regressions without paid providers.
- [x] Document operation and evidence; commit and push under owner identity.

## Completion Notes

Scoped character/models/preset/gallery tools and actual bounded WebP inspection; shared Default LoRA exception tested. All 6,132 active production image originals are local and supported.

Runtime rollback artifact and consistent database backup: /home/engui/engui-runs/engui-mcp-20261111/. Agent evidence: runs/engui-mcp-implementation-20261111/. Publication uses Artem Ovechkin / itzing. No paid generation was launched.
