---
id: ENGUI-280
title: Add Pose Library bulk missing-preview generation
status: Done
assignee: []
created_date: '[PosixPath('backlog/tasks/engui-270 - Add-persisted-Studio-Pose-Library-schema-and-domain-types.md'), PosixPath('backlog/tasks/engui-271 - Seed-current-static-pose-library-into-persisted-Pose-Library.md'), PosixPath('backlog/tasks/engui-272 - Materialize-Pose-Library-snapshots-into-Studio-shots.md'), PosixPath('backlog/tasks/engui-273 - Build-Pose-Library-CRUD-and-reorder-APIs.md'), PosixPath('backlog/tasks/engui-274 - Add-Pose-Library-left-nav-route-shell-and-breadcrumbs.md'), PosixPath('backlog/tasks/engui-275 - Build-Pose-Library-category-grid-and-category-management-UI.md'), PosixPath('backlog/tasks/engui-276 - Build-Pose-Library-pose-grid-detail-and-management-UI.md'), PosixPath('backlog/tasks/engui-277 - Add-contextual-Pose-Library-toolbar-search-filters-and-settings.md'), PosixPath('backlog/tasks/engui-278 - Implement-Pose-Library-preview-prompt-assembly-and-single-pose-jobs.md'), PosixPath('backlog/tasks/engui-279 - Build-Pose-preview-candidate-UI-primary-selection-deletion-and-lightbox.md')]'
labels:
  - studio-sessions
  - pose-library
  - desktop
  - generation
  - api
  - ui
priority: high
dependencies: 
  - ENGUI-278
  - ENGUI-279
---

## Description

Add bulk preview generation for missing previews across the full library or a single category with explicit confirmation and queue control.

Reference:

- `docs/studio-pose-library-spec.md`
- `docs/studio-pose-library-implementation-plan.md`

## Acceptance Criteria

- [x] Bulk generation is available for all missing previews in the library and missing previews in the current category.
- [x] UI shows explicit confirmation with counts such as poses × variants = images before enqueueing.
- [x] Bulk jobs use the common generation/jobs pipeline with concurrency/queue control.
- [x] Successful outputs attach to their corresponding poses as candidates.
- [x] No large generation batch launches silently.

## Implementation Notes

Added bulk missing-preview generation API and toolbar action with explicit estimate/confirmation before queueing jobs. It uses the shared generation/jobs pipeline and studio_pose_preview materialization. No bulk jobs were launched during implementation.
