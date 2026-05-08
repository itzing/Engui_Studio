---
id: ENGUI-270
title: Add persisted Studio Pose Library schema and domain types
status: To Do
assignee: []
created_date: '[]'
labels:
  - studio-sessions
  - pose-library
  - desktop
  - data
priority: high
dependencies: []
---

## Description

Create the persisted workspace-scoped data foundation for Pose Library categories, poses, preview candidates, and global preview settings.

Reference:

- `docs/studio-pose-library-spec.md`
- `docs/studio-pose-library-implementation-plan.md`

## Acceptance Criteria

- [ ] Prisma models exist for pose categories, poses, preview candidates, and library preview settings.
- [ ] Domain TypeScript types and serializers cover category summaries, pose summaries/details, preview candidates, and settings.
- [ ] Categories and poses support manual ordering and technical IDs/slugs under the hood without exposing them in normal UI.
- [ ] Helpers can list categories with pose counts and missing-preview counts.
- [ ] Validation covers Prisma schema and core serialization helpers.
