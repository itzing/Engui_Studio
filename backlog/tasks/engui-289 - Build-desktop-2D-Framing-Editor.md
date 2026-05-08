---
id: ENGUI-289
title: Build desktop 2D Framing Editor
status: Todo
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

- [ ] Editor supports orientation and aspect ratio selection with defaults: portrait `2:3`, landscape `3:2`, square `1:1`.
- [ ] User can drag skeleton placement, scale pose height, rotate in 2D, and flip X.
- [ ] Editor stores only relative values, not pixel dimensions.
- [ ] Editor can preview with a generic skeleton and preferably a selected pose skeleton when available.
- [ ] Saved values round-trip through API and reopen correctly.

## Implementation Notes

Aspect ratio controls editor canvas shape. Actual generation dimensions are resolved later by run settings/materialization.
