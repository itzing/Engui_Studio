---
id: engui-151
title: Build unified create draft store v2 and storage adapters
status: planned
priority: high
labels: [mobile, desktop, shared-logic, frontend, spec]
created_at: 2026-04-20
updated_at: 2026-04-20
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
- [ ] `engui.create.state.v2` load/save helpers are implemented
- [ ] v1-to-v2 migration is implemented and covered by tests
- [ ] Drafts are addressable by workflow and model id
- [ ] Local file blobs are stored via IndexedDB helpers, not embedded in serialized draft JSON
- [ ] Media refs can be serialized and hydrated deterministically
- [ ] Legacy mobile pending keys are identified for retirement in the new store layer
