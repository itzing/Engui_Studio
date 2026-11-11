---
id: ENGUI-582
title: Implement workspace-bound MCP transport and credential administration
status: Done
updated_date: '2026-11-11 20:23'
assignee: []
created_date: '2026-11-11 20:04'
labels: [mcp, backend]
dependencies: []
---

## Description

Pinned SDK, strict scoped authentication, protocol integration and local token CLI.

Owner14303 authorizes implementation of docs/engui-mcp-character-concepts-v1-spec.md, explicitly excluding client connection setup. Backend-only; no desktop/mobile changes. No paid generation validation.

## Acceptance Criteria

- [x] Implement the scoped specification requirements for this slice.
- [x] Validate behavior and relevant regressions without paid providers.
- [x] Document operation and evidence; commit and push under owner identity.

## Completion Notes

Pinned SDK 1.32.2, stateless Node HTTP endpoint, strict per-request workspace/auth checks, local hashed-token CLI and feature gate.

Runtime rollback artifact and consistent database backup: /home/engui/engui-runs/engui-mcp-20261111/. Agent evidence: runs/engui-mcp-implementation-20261111/. Publication uses Artem Ovechkin / itzing. No paid generation was launched.
