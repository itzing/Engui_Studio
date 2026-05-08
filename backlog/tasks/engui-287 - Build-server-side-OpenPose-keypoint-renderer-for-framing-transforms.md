---
id: ENGUI-287
title: Build server-side OpenPose keypoint renderer for framing transforms
status: Done
assignee: []
created_date: '2026-05-08'
labels:
  - studio-sessions
  - framing-library
  - openpose
  - renderer
priority: high
dependencies: 
  - ENGUI-284
  - ENGUI-285
---

## Description
Create the authoritative server-side renderer that turns pose keypoints plus framing transform plus output dimensions into an exact-size OpenPose control PNG.

Reference:

- `docs/studio-frame-library-spec.md`
- `docs/studio-frame-library-implementation-plan.md`

## Acceptance Criteria

- [x] Renderer accepts keypoints, width, height, and framing transform.
- [x] Renderer applies bbox normalization, flipX, 2D rotation, poseHeight scaling, and centerX/centerY translation.
- [x] Output PNG dimensions exactly match requested generation dimensions.
- [x] Missing/low-confidence keypoints are handled safely.
- [x] Transform math has targeted tests or deterministic sample validation.

## Completion Notes

- Added `src/lib/studio-sessions/openPoseRenderer.ts` with dependency-free server-side PNG rendering using Node buffers/zlib.
- Supports common OpenPose/DWPose keypoint shapes including `people[].pose_keypoints_2d`, nested `candidate`/`keypoints`, and point-object arrays.
- Applies visible-keypoint bbox normalization, optional `flipX`, 2D `rotationDeg`, `poseHeight` scaling, and `centerX`/`centerY` placement.
- Renders exact-size RGBA PNG on black background with OpenPose-style colored limbs/joints and optional `outputPath` write.
- Added deterministic tests in `tests/lib/studio-openpose-renderer.test.ts` for extraction, transform math, PNG dimensions, and empty/missing-keypoint safety.

## Implementation Notes

Server rendering is source of truth. Browser canvas is only a preview/editor. Consider SVG+sharp if native canvas dependency is risky.
