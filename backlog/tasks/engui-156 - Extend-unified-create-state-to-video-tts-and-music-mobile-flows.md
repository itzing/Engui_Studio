---
id: engui-156
title: Extend unified create state to video TTS and music mobile flows
status: planned
priority: high
labels: [mobile, create, frontend, video, audio]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary
Extend the unified create-state contract beyond image workflow so mobile video, TTS, and music flows also preserve drafts per workflow and per model under the same route-scoped provider.

## Desired outcome
The mobile create mode switcher uses one consistent state model for all workflows, and each workflow restores the last draft used for each model instead of falling back to unrelated global state.

## Dependencies
- ENGUI-151
- ENGUI-153
- ENGUI-154
- `backlog/specs/unified-create-state-implementation.md`

## Scope
- Define draft schemas for video, TTS, and music workflows.
- Wire mobile mode switching to unified store `activeMode` and workflow buckets.
- Preserve active model per workflow.
- Preserve per-model drafts for non-image workflows.
- Keep existing submit flows working after state migration.

## Acceptance criteria
- [ ] Mobile video workflow preserves drafts independently per video model
- [ ] Mobile TTS workflow preserves drafts independently per TTS model
- [ ] Mobile music workflow preserves drafts independently per music model
- [ ] Switching mobile create mode restores the correct active model and draft for that workflow
- [ ] Existing mobile non-image generation flows still submit successfully after migration
