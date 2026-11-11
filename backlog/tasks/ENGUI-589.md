---
id: ENGUI-589
title: Complete MCP character authoring and versioned concept iteration
status: Done
assignee: []
created_date: '2026-11-11 21:00'
labels: [mcp, characters]
dependencies: [ENGUI-586]
---

## Description

Owner14352 authorized completing the character workflow after confirming Claude connectivity. Expose creation, partial editing, version inspection and outfit/wardrobe authoring through the workspace-bound MCP. Preserve existing Character/Outfit entities; no new concept UI or desktop/mobile changes. No paid validation runs.

## Acceptance Criteria

- [x] Claude can create and edit a character without replacing omitted traits or UI state.
- [x] Mutations are workspace-bound, permission-gated, idempotent and reject stale edits.
- [x] Character versions preserve identity; old generation plans remain immutable and new plans reflect edits.
- [x] Outfit creation/editing and wardrobe/default selection are available with scoped revision checks.
- [x] Official SDK tests cover create/read/prepare/review/edit/reprepare with a fake provider, isolation and retries.
- [x] Document contracts, build, deploy, verify discovery without paid jobs, commit and push as owner.

## Rollback

Preserve the serving build and back up SQLite before any additive migration. Restore the previous build to remove authoring tools; preserve user data and existing connection credentials. Never reset private Tailscale routing.

## Delivery evidence

- Server v1.1.0 exposes 23 tools for the existing full-scope credential; read-only discovery has 13 tools.
- 71 focused tests passed, including nine new database-backed authoring scenarios, full fake-provider iteration and current UI identity-version behavior.
- Updated stale route-test mocks to the current workspace/preview contracts. Integration tests use a fresh isolated schema; using a production copy for fixture creation initially collided with the existing protected Default workspace constraint.
- Additive migration rehearsal preserved 59 existing tables and 53,758 rows (excluding migration ledger changes); repeated application is a no-op.
- Isolated production build passed. Built HTTP SDK validated create/edit/history/outfits/default selection, idempotency, wrong workspace and revoked credential. No generation authority was granted to that fixture.
- Production deployed with database backup and retained previous build. Public TLS SDK discovery sees 23 tools and Fairy Tale with the unchanged credential; invalid auth401, workspace mismatch403, non-MCP paths404.
- Production character/version/credential/batch counts remain78/121/1/0. No production fixture writes, paid generations or OpenClaw connection.
- Global TypeScript diagnostics remain outside changed files; no new authoring-module diagnostics.
- Evidence: workspace runs/engui-mcp-authoring-20261111/ and /home/engui/engui-runs/engui-mcp-authoring-20261111/. Prior build and production-before-authoring.db are in the latter directory.
