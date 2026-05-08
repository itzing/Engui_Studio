---
id: ENGUI-283
title: Run final Pose Library QA build deploy and documentation pass
status: To Do
assignee: []
created_date: '[PosixPath('backlog/tasks/engui-270 - Add-persisted-Studio-Pose-Library-schema-and-domain-types.md'), PosixPath('backlog/tasks/engui-271 - Seed-current-static-pose-library-into-persisted-Pose-Library.md'), PosixPath('backlog/tasks/engui-272 - Materialize-Pose-Library-snapshots-into-Studio-shots.md'), PosixPath('backlog/tasks/engui-273 - Build-Pose-Library-CRUD-and-reorder-APIs.md'), PosixPath('backlog/tasks/engui-274 - Add-Pose-Library-left-nav-route-shell-and-breadcrumbs.md'), PosixPath('backlog/tasks/engui-275 - Build-Pose-Library-category-grid-and-category-management-UI.md'), PosixPath('backlog/tasks/engui-276 - Build-Pose-Library-pose-grid-detail-and-management-UI.md'), PosixPath('backlog/tasks/engui-277 - Add-contextual-Pose-Library-toolbar-search-filters-and-settings.md'), PosixPath('backlog/tasks/engui-278 - Implement-Pose-Library-preview-prompt-assembly-and-single-pose-jobs.md'), PosixPath('backlog/tasks/engui-279 - Build-Pose-preview-candidate-UI-primary-selection-deletion-and-lightbox.md'), PosixPath('backlog/tasks/engui-280 - Add-Pose-Library-bulk-missing-preview-generation.md'), PosixPath('backlog/tasks/engui-281 - Implement-Pose-Library-structure-only-import-export.md'), PosixPath('backlog/tasks/engui-282 - Polish-Pose-Library-hard-delete-cleanup-confirmations-and-edge-states.md')]'
labels:
  - studio-sessions
  - pose-library
  - desktop
  - qa
  - deploy
priority: high
dependencies: 
  - ENGUI-270
  - ENGUI-271
  - ENGUI-272
  - ENGUI-273
  - ENGUI-274
  - ENGUI-275
  - ENGUI-276
  - ENGUI-277
  - ENGUI-278
  - ENGUI-279
  - ENGUI-280
  - ENGUI-281
  - ENGUI-282
---

## Description

Perform final integrated QA for the Pose Library, update docs if implementation differs, build, deploy, and smoke test.

Reference:

- `docs/studio-pose-library-spec.md`
- `docs/studio-pose-library-implementation-plan.md`

## Acceptance Criteria

- [ ] Targeted tests pass for pose library helpers, APIs, snapshot/rerun behavior, prompt assembly, preview materialization, and import/export.
- [ ] `npm run build` passes.
- [ ] SQLite database is backed up before deployed schema changes are applied.
- [ ] `engui-studio.service` is restarted after deployment.
- [ ] Smoke checks pass for `/studio-sessions`, `/studio-sessions/pose-library`, representative Pose Library APIs, and existing Studio run flows.
