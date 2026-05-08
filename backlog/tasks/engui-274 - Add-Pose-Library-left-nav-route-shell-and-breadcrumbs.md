---
id: ENGUI-274
title: Add Pose Library left-nav route shell and breadcrumbs
status: Done
assignee: []
created_date: '[PosixPath('backlog/tasks/engui-270 - Add-persisted-Studio-Pose-Library-schema-and-domain-types.md'), PosixPath('backlog/tasks/engui-271 - Seed-current-static-pose-library-into-persisted-Pose-Library.md'), PosixPath('backlog/tasks/engui-272 - Materialize-Pose-Library-snapshots-into-Studio-shots.md'), PosixPath('backlog/tasks/engui-273 - Build-Pose-Library-CRUD-and-reorder-APIs.md')]'
labels:
  - studio-sessions
  - pose-library
  - desktop
  - ui
priority: high
dependencies: 
  - ENGUI-273
---

## Description

Add Pose Library as a desktop F-Studio top-level section with route-based navigation and breadcrumbs.

Reference:

- `docs/studio-pose-library-spec.md`
- `docs/studio-pose-library-implementation-plan.md`

## Acceptance Criteria

- [x] Left nav includes `Pose Library` at the same level as `Portfolios`.
- [x] `/studio-sessions/pose-library` renders the Pose Library home shell.
- [x] Routes exist for all poses, category detail, and pose detail.
- [x] Breadcrumbs match `Pose Library / All poses / Category / Pose` expectations and ancestors are clickable.
- [x] No mobile UI is introduced.

## Implementation Notes

Added Pose Library left-nav entry, route pages for library/all/category/pose detail, breadcrumbs, and desktop F-Studio shell integration.
