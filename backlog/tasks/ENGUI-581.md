---
id: ENGUI-581
title: Specify workspace-bound MCP for character concept generation
status: Done
assignee: []
created_date: '2026-11-11 19:52'
updated_date: '2026-11-11 20:01'
labels: [spec, backend, api]
dependencies: []
---

## Description

Owner14297 authorized writing a specification for an Engui MCP focused on fighting-game character concepts, followed later by drawn 2D sprites and combat-animation frames. Each MCP connection must be bound to one workspace, using the existing x-workspace-id header for HTTP. This ticket authorizes documentation only, not MCP implementation, schema migration, configuration changes, or live generation.

## Acceptance Criteria

- [x] Specify transport, authentication, fixed workspace ownership and OpenClaw connection setup.
- [x] Define bounded tools, typed inputs/outputs, model/reference support, image inspection and approved-reference tracking.
- [x] Define asynchronous generation, immutable snapshots, idempotency, ambiguous provider outcomes and cancellation.
- [x] Identify existing code reuse versus new implementation, data/lifecycle requirements, acceptance tests and rollout/rollback.
- [x] Review specification against current source; commit/push under owner identity and complete standing build/restart checks without generation jobs.

## Deliverable

- docs/engui-mcp-character-concepts-v1-spec.md
## Completion Notes

- Delivered a source-checked specification with 15 tools, fixed-workspace authentication, durable asynchronous batches, immutable generation plans and versioned approved references.
- Reviewed local links, tool uniqueness, Markdown fences and documented current-versus-proposed boundaries. No application code, schema or runtime configuration changes.
- Isolated production build passed (exit 0); original serving build was intentionally preserved because this is documentation-only.
- Restarted engui-studio.service and verified HTTP 200 for /, /m/create and /m/gallery. No generation jobs were launched.
- Published with the specification under the owner's Git identity. Evidence: /home/engui/engui-runs/engui-581-20261111/ and the agent run report engui-mcp-spec-20261111.
