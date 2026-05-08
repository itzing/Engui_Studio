---
id: ENGUI-284
title: Add OpenPose fields to Studio Pose Library schema and types
status: Done
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

- [x] `StudioPose` supports OpenPose image URL, encrypted keypoint JSON, extraction source image/job metadata, and extraction timestamp.
- [x] Existing text-only poses remain valid and require no migration to OpenPose.
- [x] Pose summary/detail serializers expose OpenPose status safely.
- [x] Plaintext keypoints are never logged or returned in normal UI/API payloads.
- [x] Prisma schema validates and existing Studio/Pose Library routes still build.

## Implementation Notes

Start from Phase 1 of the implementation plan. Prefer minimal schema changes and keep backward compatibility with existing Pose Library data.

Completed in first implementation slice: added nullable OpenPose fields to `StudioPose`, generated Prisma client after `db push`, exposed safe `openPose` status metadata in pose summaries without returning encrypted keypoint payloads, copied OpenPose metadata on duplicate, cleared OpenPose metadata when pose body/view semantics change, and surfaced text-only/OpenPose status in the Pose Library UI. DB backup: `prisma/db/backups/database.db.bak.openpose-fields-20260508T121233Z`.
