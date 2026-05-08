---
id: ENGUI-270
title: Add persisted Studio Pose Library schema and domain types
status: Done
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

- [x] Prisma models exist for pose categories, poses, preview candidates, and library preview settings.
- [x] Domain TypeScript types and serializers cover category summaries, pose summaries/details, preview candidates, and settings.
- [x] Categories and poses support manual ordering and technical IDs/slugs under the hood without exposing them in normal UI.
- [x] Helpers can list categories with pose counts and missing-preview counts.
- [x] Validation covers Prisma schema and core serialization helpers.

## Implementation Notes

Implemented Prisma schema for StudioPoseLibrarySettings, StudioPoseCategory, StudioPose, and StudioPosePreviewCandidate; added domain summaries, serializers, settings helpers, and list/create/update/delete/duplicate/reorder server helpers in poseLibraryServer.
