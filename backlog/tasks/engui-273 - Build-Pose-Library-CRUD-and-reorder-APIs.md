---
id: ENGUI-273
title: Build Pose Library CRUD and reorder APIs
status: To Do
assignee: []
created_date: '[PosixPath('backlog/tasks/engui-270 - Add-persisted-Studio-Pose-Library-schema-and-domain-types.md'), PosixPath('backlog/tasks/engui-271 - Seed-current-static-pose-library-into-persisted-Pose-Library.md'), PosixPath('backlog/tasks/engui-272 - Materialize-Pose-Library-snapshots-into-Studio-shots.md')]'
labels:
  - studio-sessions
  - pose-library
  - desktop
  - api
priority: high
dependencies: 
  - ENGUI-270
---

## Description

Add workspace-scoped internal API routes for category and pose CRUD, deletion, duplication, movement, and ordering.

Reference:

- `docs/studio-pose-library-spec.md`
- `docs/studio-pose-library-implementation-plan.md`

## Acceptance Criteria

- [ ] API supports category list/create/update/delete/reorder.
- [ ] API supports pose list/detail/create/update/delete/duplicate/reorder/move-category.
- [ ] Hard deleting a category deletes contained library poses and preview candidates/assets without touching materialized shots.
- [ ] Hard deleting a pose deletes its preview candidates/assets without touching materialized shots.
- [ ] Routes are workspace-scoped and covered by targeted tests.
