---
id: engui-151
title: Build unified create draft store v2 and storage adapters
status: done
priority: high
labels: [mobile, desktop, shared-logic, frontend, spec]
created_at: 2026-04-20
updated_at: 2026-04-20
completed_at: 2026-04-20
assignee: openclaw
---

## Summary
Build the versioned unified create draft store, including the v2 serialized schema, localStorage persistence, IndexedDB media adapters, and migration from the current v1 state shape.

## Desired outcome
The codebase has a single shared persistence foundation that can store per-workflow and per-model drafts without depending on route timing or screen-local hydration effects.

## Dependencies
- ENGUI-150
- `backlog/specs/unified-create-state-implementation.md`

## Scope
- Add the v2 unified state schema for image, video, TTS, and music workflows.
- Implement pure load/save helpers for `engui.create.state.v2`.
- Implement migration from `engui.create.state.v1`.
- Add IndexedDB helpers for durable local media persistence.
- Add media-ref serialization contracts.
- Add cleanup helpers for orphaned local media refs.
- Keep the module React-agnostic.

## Acceptance criteria
- [x] `engui.create.state.v2` load/save helpers are implemented
- [x] v1-to-v2 migration is implemented and covered by tests
- [x] Drafts are addressable by workflow and model id
- [x] Local file blobs are stored via IndexedDB helpers, not embedded in serialized draft JSON
- [x] Media refs can be serialized and hydrated deterministically
- [x] Legacy mobile pending keys are identified for retirement in the new store layer

## Completion notes

Implemented the v2 create-state foundation under `src/lib/create/` with a compatibility layer that keeps existing callers working through `src/lib/createDrafts.ts`. Added:
- `createDraftSchema.ts` for v2 schema and media-ref types
- `createDraftStore.ts` for load/save and workflow/model-addressable state updates
- `createDraftMigrations.ts` for legacy v1 migration into v2 envelopes
- `createMediaStore.ts` for IndexedDB-backed media helpers and referenced-media collection
- `tests/lib/create-drafts-v2.test.ts` for v2 save/load, migration, and media-id collection coverage

Validation:
- `npx vitest --run tests/lib/create-drafts.test.ts tests/lib/create-drafts-v2.test.ts` ✅
- `npm run build` ✅

Note: `npx tsc --noEmit` still reports pre-existing unrelated repository errors outside this ticket scope; the project build path remains green.
