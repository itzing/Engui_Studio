---
id: engui-156
title: Extend unified create state to video TTS and music mobile flows
status: done
priority: high
labels: [mobile, create, frontend, video, audio]
created_at: 2026-04-20
updated_at: 2026-04-20
completed_at: 2026-04-20
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
- [x] Mobile video workflow preserves drafts independently per video model
- [x] Mobile TTS workflow preserves drafts independently per TTS model
- [x] Mobile music workflow preserves drafts independently per music model
- [x] Switching mobile create mode restores the correct active model and draft for that workflow
- [x] Existing mobile non-image generation flows still submit successfully after migration

## Completion notes

Completed the non-image mobile create-state convergence on top of the unified workflow/model buckets.

Changes:
- decoupled `VideoGenerationForm` from the global `StudioContext.selectedModel` read path and moved it onto workflow-scoped video model state restored from `getWorkflowActiveModel('video')`
- kept context selection synced outward from the active video workflow model for compatibility, but video draft hydration/save now keys off the workflow-local model instead of shared cross-workflow state
- verified that TTS and music mobile flows already persist their own `selectedModel` plus per-model drafts via the unified `tts` and `music` workflow buckets
- added a regression test covering independent `activeModel` and draft persistence across image, video, TTS, and music workflows

Validation:
- `npx vitest --run tests/lib/create-drafts-v2.test.ts` ✅
- `npm run build` ✅
