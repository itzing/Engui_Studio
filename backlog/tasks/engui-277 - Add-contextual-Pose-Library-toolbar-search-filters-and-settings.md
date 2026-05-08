---
id: ENGUI-277
title: Add contextual Pose Library toolbar search filters and settings
status: Done
assignee: []
created_date: '[PosixPath('backlog/tasks/engui-270 - Add-persisted-Studio-Pose-Library-schema-and-domain-types.md'), PosixPath('backlog/tasks/engui-271 - Seed-current-static-pose-library-into-persisted-Pose-Library.md'), PosixPath('backlog/tasks/engui-272 - Materialize-Pose-Library-snapshots-into-Studio-shots.md'), PosixPath('backlog/tasks/engui-273 - Build-Pose-Library-CRUD-and-reorder-APIs.md'), PosixPath('backlog/tasks/engui-274 - Add-Pose-Library-left-nav-route-shell-and-breadcrumbs.md'), PosixPath('backlog/tasks/engui-275 - Build-Pose-Library-category-grid-and-category-management-UI.md'), PosixPath('backlog/tasks/engui-276 - Build-Pose-Library-pose-grid-detail-and-management-UI.md')]'
labels:
  - studio-sessions
  - pose-library
  - desktop
  - ui
priority: high
dependencies: 
  - ENGUI-276
---

## Description

Implement the local central-panel slide-out toolbar for Pose Library tools, search, filters, import/export entry points, and global preview settings.

Reference:

- `docs/studio-pose-library-spec.md`
- `docs/studio-pose-library-implementation-plan.md`

## Acceptance Criteria

- [x] Library toolbar opens from inside the Pose Library main panel and is scoped to the central canvas, not global app height.
- [x] Toolbar can coexist with the global Jobs panel.
- [x] Toolbar contexts differ for library/all-poses and category detail.
- [x] Search covers title, prompt, and tags; filters include category, orientation, framing, camera angle, and has/missing preview.
- [x] Global preview subject/settings can be edited and affect only future preview generations.

## Implementation Notes

Expanded contextual Pose Library toolbar with search, missing/has-preview filter, preview variant count, bulk missing-preview action, and import/export actions scoped to full library or current category.
