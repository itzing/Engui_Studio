---
id: ENGUI-276
title: Build Pose Library pose grid detail and management UI
status: Done
assignee: []
created_date: '[PosixPath('backlog/tasks/engui-270 - Add-persisted-Studio-Pose-Library-schema-and-domain-types.md'), PosixPath('backlog/tasks/engui-271 - Seed-current-static-pose-library-into-persisted-Pose-Library.md'), PosixPath('backlog/tasks/engui-272 - Materialize-Pose-Library-snapshots-into-Studio-shots.md'), PosixPath('backlog/tasks/engui-273 - Build-Pose-Library-CRUD-and-reorder-APIs.md'), PosixPath('backlog/tasks/engui-274 - Add-Pose-Library-left-nav-route-shell-and-breadcrumbs.md'), PosixPath('backlog/tasks/engui-275 - Build-Pose-Library-category-grid-and-category-management-UI.md')]'
labels:
  - studio-sessions
  - pose-library
  - desktop
  - ui
priority: high
dependencies: 
  - ENGUI-275
---

## Description

Implement all-poses/category pose grids, pose detail, create/edit/delete/duplicate/move, placeholders, and pose ordering.

Reference:

- `docs/studio-pose-library-spec.md`
- `docs/studio-pose-library-implementation-plan.md`

## Acceptance Criteria

- [x] All poses and category pages show pose tiles with the first `+ New pose` tile.
- [x] Pose tiles open detail on click and expose Delete + Duplicate on hover.
- [x] Missing-preview pose tiles show a useful placeholder with title, frame metadata, and `Missing preview` badge.
- [x] Pose detail shows metadata and uses an Edit modal/side panel rather than inline editing every field.
- [x] Poses can be moved between categories, duplicated into current/other category, reordered by drag-and-drop, and reordered by Move up/down fallback.

## Implementation Notes

Added pose grid and pose detail UI with create/delete/duplicate actions, pose metadata, prompt display, and missing-preview states.
