---
id: ENGUI-614
title: Manage Vibes through MCP and verify frozen generation use
status: In Progress
created_date: '2026-11-25'
labels: [mcp, vibes]
---

## Scope
Owner14919: MCP Vibe creation, editing, deletion and use in generation. No desktop/mobile changes or endpoint changes; no paid test generations.

## Design
Reuse existing workspace VibePreset records and soft-delete behavior. Add list/get/create/update/delete/restore tools. Curate scope, durable idempotency receipts and optimistic revision checks for writes. Preserve omitted fields, normalize tags consistently with UI. Existing vibeId generation selection remains; freeze exact description once, reject stale/deleted sources before dispatch and preserve historical plans/jobs. Add discoverable instructions and complete tool schemas.

## Verification
Isolated DB MCP SDK checks: permissions/workspace boundary, CRUD and retry/conflict, partial updates, trash/restore, prompts/tags and encrypted provider payload, stale plans and no duplicate prefix. Regression tests, isolated production build, candidate HTTP test, deployment with retained previous.next and public read-only verification. No schema migration.

## Rollback
Restore retained previous.next and restart engui-studio.service. Existing Vibe records are unchanged by deployment and remain UI-compatible.

## Validation before rollout
203 focused/regression checks passed (including24 new Vibe tests), plus25 actual HTTP SDK checks on isolated production candidate. All four model adapters receive the exact Vibe prefix in their encrypted request, using fake providers only. Build passed; baseline whole-project typecheck is not clean, with zero added diagnostics. Initial stale discovery-count assertions and test-only unscoped count queries were corrected and rerun. No real generation.
