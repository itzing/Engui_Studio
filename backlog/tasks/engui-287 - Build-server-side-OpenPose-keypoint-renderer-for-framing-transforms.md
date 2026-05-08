---
id: ENGUI-287
title: Build server-side OpenPose keypoint renderer for framing transforms
status: Todo
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

- [ ] Renderer accepts keypoints, width, height, and framing transform.
- [ ] Renderer applies bbox normalization, flipX, 2D rotation, poseHeight scaling, and centerX/centerY translation.
- [ ] Output PNG dimensions exactly match requested generation dimensions.
- [ ] Missing/low-confidence keypoints are handled safely.
- [ ] Transform math has targeted tests or deterministic sample validation.

## Implementation Notes

Server rendering is source of truth. Browser canvas is only a preview/editor. Consider SVG+sharp if native canvas dependency is risky.
