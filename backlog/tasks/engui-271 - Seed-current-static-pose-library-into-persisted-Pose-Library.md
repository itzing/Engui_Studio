---
id: ENGUI-271
title: Seed current static pose library into persisted Pose Library
status: Done
assignee: []
created_date: '[PosixPath('backlog/tasks/engui-270 - Add-persisted-Studio-Pose-Library-schema-and-domain-types.md')]'
labels:
  - studio-sessions
  - pose-library
  - desktop
  - data
  - migration
priority: high
dependencies: 
  - ENGUI-270
---

## Description

Provide a safe migration/seed path from the current static Studio pose library into the new persisted Pose Library tables.

Reference:

- `docs/studio-pose-library-spec.md`
- `docs/studio-pose-library-implementation-plan.md`

## Acceptance Criteria

- [x] Existing normalized/static pose categories can be imported into persisted categories and poses.
- [x] Seed/import is idempotent or guarded against accidental duplicate full seeds.
- [x] Imported poses are usable immediately and start with missing preview state.
- [x] No preview assets are required for seeded poses.
- [x] Tests or a dry-run fixture validate category/pose counts after seed.

## Implementation Notes

Added automatic first-use seed from the existing static Studio pose library into persisted workspace categories/poses. Smoke checked the default workspace API: 9 categories seeded with pose counts and missing-preview counts.
