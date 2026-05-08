---
id: ENGUI-286
title: Add OpenPose extraction materialization for Studio poses
status: Done
assignee: []
created_date: '2026-05-08'
labels:
  - studio-sessions
  - pose-library
  - openpose
  - jobs
priority: high
dependencies: 
  - ENGUI-284
---

## Description
Wire the Z-Image `openpose_extract` endpoint mode into Pose Library so a pose can be enhanced from an uploaded/source/generated image.

Reference:

- `docs/studio-frame-library-spec.md`
- `docs/studio-frame-library-implementation-plan.md`

## Acceptance Criteria

- [x] Pose detail can queue OpenPose extraction from a supported source image or preview candidate.
- [x] Extraction job stores OpenPose PNG and encrypted `pose_keypoint_encrypted` data back on the pose.
- [x] Pose extraction source image/job metadata and timestamp are recorded.
- [x] Replace and clear OpenPose data flows exist with safe confirmations.
- [x] Text-only pose behavior remains unchanged when no OpenPose data exists.

## Completion Notes

- Added `POST /api/studio/pose-library/poses/[id]/openpose` to queue `openpose_extract` through `/api/generate`/`submitGenerationFormData` without running live QA jobs.
- Added `DELETE /api/studio/pose-library/poses/[id]/openpose?confirmClear=true` clear flow with confirmation response when data exists.
- Added `studio_pose_openpose` materialization task handling to store materialized OpenPose PNG, encrypted `pose_keypoint_encrypted`, source image URL, source job ID, and extraction timestamp on `StudioPose`.
- Preserved text-only pose behavior: `StudioSessionPoseSnapshot.openPose` is optional metadata and generation flow is not changed in this slice.

## Implementation Notes

Preserve encryption: store encrypted keypoint payload, not plaintext. Do not launch live extraction jobs without explicit approval during QA.
