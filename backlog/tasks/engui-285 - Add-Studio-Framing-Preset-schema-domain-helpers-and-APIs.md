---
id: ENGUI-285
title: Add Studio Framing Preset schema domain helpers and APIs
status: Done
assignee: []
created_date: '2026-05-08'
labels:
  - studio-sessions
  - framing-library
  - data
  - api
priority: high
dependencies: 
  - ENGUI-284
---

## Description
Add the persisted Framing Library foundation for reusable run-level skeleton placement presets.

Reference:

- `docs/studio-frame-library-spec.md`
- `docs/studio-frame-library-implementation-plan.md`

## Acceptance Criteria

- [x] `StudioFramingPreset` model exists with workspace scope, orientation, aspect ratio, relative transform, helper prompt, tags, preview image, and sort order.
- [x] Framing presets store no absolute pixel dimensions.
- [x] Domain serializers and validation clamp/normalize orientation, aspect ratio, center, pose height, rotation, flip, and tags.
- [x] CRUD, duplicate, reorder, list/filter APIs exist.
- [x] Delete does not affect existing materialized runs/shots.

## Implementation Notes

Use defaults: portrait `2:3`, landscape `3:2`, square `1:1`. Keep API shape stable for the upcoming editor and run selector.

Completed in second implementation slice: added `StudioFramingPreset` Prisma model and `Workspace` relation; added `StudioFramingPresetSummary`, `StudioFramingTransform`, `StudioRunFramingPolicy`, and `StudioResolvedFramingSnapshot` shared types; added `src/lib/studio-sessions/framingLibraryServer.ts` with normalization/default helpers and CRUD/duplicate/reorder/list/filter operations; added API routes under `/api/studio/framing-presets`; applied DB schema after backup `prisma/db/backups/database.db.bak.framing-presets-20260508T122015Z`.
