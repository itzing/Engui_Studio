---
id: engui-158
title: Converge desktop create forms onto the unified draft store
status: planned
priority: medium
labels: [desktop, create, shared-logic, frontend]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary
Migrate desktop create flows to the same unified draft-store contract used by mobile so workflow and model persistence behavior remains consistent across surfaces.

## Desired outcome
Desktop and mobile share the same create-state data model and persistence semantics, reducing duplicate logic and preventing future divergence in reuse and model-switch behavior.

## Dependencies
- ENGUI-151
- ENGUI-153
- ENGUI-154
- ENGUI-156
- ENGUI-157
- `backlog/specs/unified-create-state-implementation.md`

## Scope
- Replace remaining desktop-only draft persistence paths with unified store adapters.
- Align desktop model switching with the transactional workflow/model switch contract.
- Keep existing desktop UI layout unchanged unless a targeted adjustment is required for correctness.
- Reuse the same normalization and media-ref semantics as mobile.

## Acceptance criteria
- [ ] Desktop create forms read and write the unified draft-store contract
- [ ] Desktop model switching follows the same draft-preservation rules as mobile
- [ ] Desktop reuse actions remain compatible with the shared store-first draft model
- [ ] Desktop UI behavior remains intentionally stable after convergence
- [ ] Duplicate create-draft persistence logic is removed or isolated behind a compatibility layer
