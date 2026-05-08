---
id: ENGUI-282
title: Polish Pose Library hard-delete cleanup confirmations and edge states
status: To Do
assignee: []
created_date: '[PosixPath('backlog/tasks/engui-270 - Add-persisted-Studio-Pose-Library-schema-and-domain-types.md'), PosixPath('backlog/tasks/engui-271 - Seed-current-static-pose-library-into-persisted-Pose-Library.md'), PosixPath('backlog/tasks/engui-272 - Materialize-Pose-Library-snapshots-into-Studio-shots.md'), PosixPath('backlog/tasks/engui-273 - Build-Pose-Library-CRUD-and-reorder-APIs.md'), PosixPath('backlog/tasks/engui-274 - Add-Pose-Library-left-nav-route-shell-and-breadcrumbs.md'), PosixPath('backlog/tasks/engui-275 - Build-Pose-Library-category-grid-and-category-management-UI.md'), PosixPath('backlog/tasks/engui-276 - Build-Pose-Library-pose-grid-detail-and-management-UI.md'), PosixPath('backlog/tasks/engui-277 - Add-contextual-Pose-Library-toolbar-search-filters-and-settings.md'), PosixPath('backlog/tasks/engui-278 - Implement-Pose-Library-preview-prompt-assembly-and-single-pose-jobs.md'), PosixPath('backlog/tasks/engui-279 - Build-Pose-preview-candidate-UI-primary-selection-deletion-and-lightbox.md'), PosixPath('backlog/tasks/engui-280 - Add-Pose-Library-bulk-missing-preview-generation.md'), PosixPath('backlog/tasks/engui-281 - Implement-Pose-Library-structure-only-import-export.md')]'
labels:
  - studio-sessions
  - pose-library
  - desktop
  - ui
  - api
  - qa
priority: high
dependencies: 
  - ENGUI-275
  - ENGUI-276
  - ENGUI-279
  - ENGUI-281
---

## Description

Tighten destructive flows, cleanup behavior, empty/loading/error states, and edge cases across the Pose Library.

Reference:

- `docs/studio-pose-library-spec.md`
- `docs/studio-pose-library-implementation-plan.md`

## Acceptance Criteria

- [ ] Hard-delete confirmations are clear for poses, categories, and replace-all imports.
- [ ] Deleting primary preview/candidates never leaves broken tile images.
- [ ] Category auto-cover falls back to the first ordered pose with primary preview or a placeholder.
- [ ] Empty/loading/error states are polished for library home, all poses, category, pose detail, toolbar, and preview sections.
- [ ] Asset cleanup is scoped to pose preview assets and cannot remove shot result assets.
