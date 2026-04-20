---
id: engui-158
title: Converge desktop create forms onto the unified draft store
status: done
priority: medium
labels: [desktop, create, shared-logic, frontend]
created_at: 2026-04-20
updated_at: 2026-04-20
completed_at: 2026-04-20
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
- [x] Desktop create forms read and write the unified draft-store contract
- [x] Desktop model switching follows the same draft-preservation rules as mobile
- [x] Desktop reuse actions remain compatible with the shared store-first draft model
- [x] Desktop UI behavior remains intentionally stable after convergence
- [x] Duplicate create-draft persistence logic is removed or isolated behind a compatibility layer

## Completion notes

Converged desktop create entry points onto the unified draft-store contract without changing the desktop layout.

Changes:
- added `src/lib/create/createModeEvents.ts` as a narrow UI notification bridge for desktop mode switching after draft persistence
- updated desktop reuse entry points in `StudioContext`, `CenterPanel`, and `GalleryAssetDialog` to persist target drafts first via `persistCreateReuseDraft()` instead of dispatching reuse payloads directly into mounted forms
- updated `LeftPanel` to react to unified create-mode change events and open the correct desktop form by workflow, while form state itself restores from the shared draft store
- desktop reuse now follows the same store-first semantics as mobile for image/video transitions and shared draft normalization/media-ref behavior

Validation:
- `npx vitest --run tests/lib/create-drafts-v2.test.ts tests/lib/persist-create-reuse-draft.test.ts tests/lib/image-draft-normalization.test.ts tests/lib/create-media-store.test.ts` ✅
- `npm run build` ✅
