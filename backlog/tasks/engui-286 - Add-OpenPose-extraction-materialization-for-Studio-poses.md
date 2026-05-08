---
id: ENGUI-286
title: Add OpenPose extraction materialization for Studio poses
status: Todo
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

- [ ] Pose detail can queue OpenPose extraction from a supported source image or preview candidate.
- [ ] Extraction job stores OpenPose PNG and encrypted `pose_keypoint_encrypted` data back on the pose.
- [ ] Pose extraction source image/job metadata and timestamp are recorded.
- [ ] Replace and clear OpenPose data flows exist with safe confirmations.
- [ ] Text-only pose behavior remains unchanged when no OpenPose data exists.

## Implementation Notes

Preserve encryption: store encrypted keypoint payload, not plaintext. Do not launch live extraction jobs without explicit approval during QA.
