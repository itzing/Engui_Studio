---
id: ENGUI-281
title: Implement Pose Library structure-only import export
status: To Do
assignee: []
created_date: '[PosixPath('backlog/tasks/engui-270 - Add-persisted-Studio-Pose-Library-schema-and-domain-types.md'), PosixPath('backlog/tasks/engui-271 - Seed-current-static-pose-library-into-persisted-Pose-Library.md'), PosixPath('backlog/tasks/engui-272 - Materialize-Pose-Library-snapshots-into-Studio-shots.md'), PosixPath('backlog/tasks/engui-273 - Build-Pose-Library-CRUD-and-reorder-APIs.md'), PosixPath('backlog/tasks/engui-274 - Add-Pose-Library-left-nav-route-shell-and-breadcrumbs.md'), PosixPath('backlog/tasks/engui-275 - Build-Pose-Library-category-grid-and-category-management-UI.md'), PosixPath('backlog/tasks/engui-276 - Build-Pose-Library-pose-grid-detail-and-management-UI.md'), PosixPath('backlog/tasks/engui-277 - Add-contextual-Pose-Library-toolbar-search-filters-and-settings.md'), PosixPath('backlog/tasks/engui-278 - Implement-Pose-Library-preview-prompt-assembly-and-single-pose-jobs.md'), PosixPath('backlog/tasks/engui-279 - Build-Pose-preview-candidate-UI-primary-selection-deletion-and-lightbox.md'), PosixPath('backlog/tasks/engui-280 - Add-Pose-Library-bulk-missing-preview-generation.md')]'
labels:
  - studio-sessions
  - pose-library
  - desktop
  - api
  - ui
priority: high
dependencies: 
  - ENGUI-277
---

## Description

Implement JSON import/export for the full library and individual categories with Merge and Replace all modes.

Reference:

- `docs/studio-pose-library-spec.md`
- `docs/studio-pose-library-implementation-plan.md`

## Acceptance Criteria

- [ ] Export full library and category structure without preview images/assets or job history.
- [ ] Import UI shows a readable expected JSON schema/example before upload/apply.
- [ ] Import preview validates JSON and summarizes additions, duplicate auto-renames, and destructive replace effects.
- [ ] Merge creates new records and auto-generates technical IDs/slugs for conflicts without updating existing records.
- [ ] Replace all works for full library and selected category, deletes replaced preview assets, and requires strong confirmation.
