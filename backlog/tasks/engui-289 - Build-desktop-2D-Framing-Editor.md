---
id: ENGUI-289
title: Build desktop 2D Framing Editor
status: Done
assignee: []
created_date: '2026-05-08'
labels:
  - studio-sessions
  - framing-library
  - desktop
  - editor
priority: high
dependencies: 
  - ENGUI-285
  - ENGUI-287
  - ENGUI-288
---

## Description
Build the interactive desktop editor for positioning a skeleton on an aspect-ratio canvas and saving relative framing transforms.

Reference:

- `docs/studio-frame-library-spec.md`
- `docs/studio-frame-library-implementation-plan.md`

## Acceptance Criteria

- [x] Editor supports orientation and aspect ratio selection with defaults: portrait `2:3`, landscape `3:2`, square `1:1`.
- [x] User can drag skeleton placement, scale pose height, rotate in 2D, and flip X.
- [x] Editor stores only relative values, not pixel dimensions.
- [x] Editor can preview with a generic skeleton and preferably a selected pose skeleton when available.
- [x] Saved values round-trip through API and reopen correctly.

## Implementation Notes

Aspect ratio controls editor canvas shape. Actual generation dimensions are resolved later by run settings/materialization.

## Completion Notes

- Upgraded Framing Library create/edit dialog into a desktop 2D editor with an aspect-ratio canvas.
- Added pointer-drag center editing for `centerX`/`centerY`, sliders for `poseHeight` and `rotationDeg`, `flipX`, reset placement, and orientation/aspect preset controls.
- Values are clamped/rounded and saved as relative transform fields only; no pixel dimensions are stored.
- Generic skeleton preview is used for v1; selected pose skeleton preview remains a later enhancement because pose selection is not part of this ticket.
- Verified production build and API create/update/delete round-trip for relative transform values.
