---
id: ENGUI-279
title: Build Pose preview candidate UI primary selection deletion and lightbox
status: Done
assignee: []
created_date: '[PosixPath('backlog/tasks/engui-270 - Add-persisted-Studio-Pose-Library-schema-and-domain-types.md'), PosixPath('backlog/tasks/engui-271 - Seed-current-static-pose-library-into-persisted-Pose-Library.md'), PosixPath('backlog/tasks/engui-272 - Materialize-Pose-Library-snapshots-into-Studio-shots.md'), PosixPath('backlog/tasks/engui-273 - Build-Pose-Library-CRUD-and-reorder-APIs.md'), PosixPath('backlog/tasks/engui-274 - Add-Pose-Library-left-nav-route-shell-and-breadcrumbs.md'), PosixPath('backlog/tasks/engui-275 - Build-Pose-Library-category-grid-and-category-management-UI.md'), PosixPath('backlog/tasks/engui-276 - Build-Pose-Library-pose-grid-detail-and-management-UI.md'), PosixPath('backlog/tasks/engui-277 - Add-contextual-Pose-Library-toolbar-search-filters-and-settings.md'), PosixPath('backlog/tasks/engui-278 - Implement-Pose-Library-preview-prompt-assembly-and-single-pose-jobs.md')]'
labels:
  - studio-sessions
  - pose-library
  - desktop
  - ui
  - generation
priority: high
dependencies: 
  - ENGUI-278
---

## Description

Complete pose detail preview management UI for primary preview selection, candidate deletion, generation controls, and lightbox comparison.

Reference:

- `docs/studio-pose-library-spec.md`
- `docs/studio-pose-library-implementation-plan.md`

## Acceptance Criteria

- [x] Pose detail shows primary preview and candidate grid as a central page block, not hidden in the toolbar.
- [x] User can set any candidate as primary preview.
- [x] User can delete any candidate and the underlying preview asset is removed.
- [x] Lightbox comparison is available for candidates.
- [x] Changing semantic pose fields deletes existing preview candidates/assets immediately; changing only title/tags/category/order keeps previews.

## Implementation Notes

Added preview candidate UI on pose detail with generate button, candidate grid, Set primary, and Delete actions wired to API routes. Materialization stores completed job outputs as StudioPosePreviewCandidate records and assigns the newest candidate as primary.
