---
id: ENGUI-278
title: Implement Pose Library preview prompt assembly and single-pose jobs
status: Done
assignee: []
created_date: '[PosixPath('backlog/tasks/engui-270 - Add-persisted-Studio-Pose-Library-schema-and-domain-types.md'), PosixPath('backlog/tasks/engui-271 - Seed-current-static-pose-library-into-persisted-Pose-Library.md'), PosixPath('backlog/tasks/engui-272 - Materialize-Pose-Library-snapshots-into-Studio-shots.md'), PosixPath('backlog/tasks/engui-273 - Build-Pose-Library-CRUD-and-reorder-APIs.md'), PosixPath('backlog/tasks/engui-274 - Add-Pose-Library-left-nav-route-shell-and-breadcrumbs.md'), PosixPath('backlog/tasks/engui-275 - Build-Pose-Library-category-grid-and-category-management-UI.md'), PosixPath('backlog/tasks/engui-276 - Build-Pose-Library-pose-grid-detail-and-management-UI.md'), PosixPath('backlog/tasks/engui-277 - Add-contextual-Pose-Library-toolbar-search-filters-and-settings.md')]'
labels:
  - studio-sessions
  - pose-library
  - desktop
  - generation
  - api
priority: high
dependencies: 
  - ENGUI-273
  - ENGUI-277
---

## Description

Wire single-pose preview generation to the common generation/jobs pipeline using prompts assembled only from stored library data.

Reference:

- `docs/studio-pose-library-spec.md`
- `docs/studio-pose-library-implementation-plan.md`

## Acceptance Criteria

- [x] Preview prompt assembly uses global preview settings, neutral studio/style preset, pose prompt, orientation, framing, camera angle, and shot distance.
- [x] No manual one-off override prompt is available.
- [x] Pose detail can request 1/2/4/8 variants with default 4.
- [x] Preview jobs appear in the common Jobs pipeline/panel.
- [x] Successful preview outputs are materialized as preview candidates linked to the pose.

## Implementation Notes

Added preview prompt assembly from pose metadata plus library settings and a single-pose preview generation API that queues normal generation jobs and creates JobMaterializationTask records with targetType studio_pose_preview. No live preview jobs were launched manually.
