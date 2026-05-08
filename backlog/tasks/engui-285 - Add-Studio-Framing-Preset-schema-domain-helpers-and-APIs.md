---
id: ENGUI-285
title: Add Studio Framing Preset schema domain helpers and APIs
status: Todo
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

- [ ] `StudioFramingPreset` model exists with workspace scope, orientation, aspect ratio, relative transform, helper prompt, tags, preview image, and sort order.
- [ ] Framing presets store no absolute pixel dimensions.
- [ ] Domain serializers and validation clamp/normalize orientation, aspect ratio, center, pose height, rotation, flip, and tags.
- [ ] CRUD, duplicate, reorder, list/filter APIs exist.
- [ ] Delete does not affect existing materialized runs/shots.

## Implementation Notes

Use defaults: portrait `2:3`, landscape `3:2`, square `1:1`. Keep API shape stable for the upcoming editor and run selector.
