---
id: ENGUI-284
title: Add OpenPose fields to Studio Pose Library schema and types
status: Todo
assignee: []
created_date: '2026-05-08'
labels:
  - studio-sessions
  - pose-library
  - openpose
  - data
priority: high
dependencies: []
---

## Description
Extend the persisted Studio Pose Library so poses can optionally store OpenPose/DWPose control data while preserving existing text-only behavior.

Reference:

- `docs/studio-frame-library-spec.md`
- `docs/studio-frame-library-implementation-plan.md`

## Acceptance Criteria

- [ ] `StudioPose` supports OpenPose image URL, encrypted keypoint JSON, extraction source image/job metadata, and extraction timestamp.
- [ ] Existing text-only poses remain valid and require no migration to OpenPose.
- [ ] Pose summary/detail serializers expose OpenPose status safely.
- [ ] Plaintext keypoints are never logged or returned in normal UI/API payloads.
- [ ] Prisma schema validates and existing Studio/Pose Library routes still build.

## Implementation Notes

Start from Phase 1 of the implementation plan. Prefer minimal schema changes and keep backward compatibility with existing Pose Library data.
