---
id: ENGUI-275
title: Build Pose Library category grid and category management UI
status: To Do
assignee: []
created_date: '[PosixPath('backlog/tasks/engui-270 - Add-persisted-Studio-Pose-Library-schema-and-domain-types.md'), PosixPath('backlog/tasks/engui-271 - Seed-current-static-pose-library-into-persisted-Pose-Library.md'), PosixPath('backlog/tasks/engui-272 - Materialize-Pose-Library-snapshots-into-Studio-shots.md'), PosixPath('backlog/tasks/engui-273 - Build-Pose-Library-CRUD-and-reorder-APIs.md'), PosixPath('backlog/tasks/engui-274 - Add-Pose-Library-left-nav-route-shell-and-breadcrumbs.md')]'
labels:
  - studio-sessions
  - pose-library
  - desktop
  - ui
priority: high
dependencies: 
  - ENGUI-274
---

## Description

Implement the Pose Library home category grid, category creation/editing/deletion, covers, counts, and ordering.

Reference:

- `docs/studio-pose-library-spec.md`
- `docs/studio-pose-library-implementation-plan.md`

## Acceptance Criteria

- [ ] Library home shows category tiles in the main canvas with the first `+ New category` tile.
- [ ] Category tiles show cover, name, pose count, missing-preview count, and optional last updated metadata.
- [ ] Category tile hover action exposes Delete only.
- [ ] Category create/edit flows support name, description, order, and cover pose/auto-cover behavior.
- [ ] Category drag-and-drop reorder saves immediately, reverts on failure, and has Move up/down fallback.
