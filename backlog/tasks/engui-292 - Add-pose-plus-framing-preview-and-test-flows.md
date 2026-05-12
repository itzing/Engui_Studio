---
id: ENGUI-292
title: Add pose plus framing preview and test flows
status: Done
assignee: []
created_date: '2026-05-08'
labels:
  - studio-sessions
  - framing-library
  - pose-library
  - preview
priority: high
dependencies: 
  - ENGUI-286
  - ENGUI-289
  - ENGUI-291
---

## Description
Add safe preview/test workflows for validating a selected pose with a selected framing preset before using it in full runs.

Reference:

- `docs/studio-frame-library-spec.md`
- `docs/studio-frame-library-implementation-plan.md`

## Acceptance Criteria

- [x] User can render/inspect a control PNG for pose + framing without launching a paid generation job.
- [x] User can optionally launch a Z-Image ControlNet preview only after explicit confirmation.
- [x] Pose preview candidate → OpenPose extraction → attach to pose flow is supported.
- [x] Framing preview assets are stored in a scoped directory and cleanup cannot delete normal shot result assets.
- [x] UI communicates when a pose lacks OpenPose data and will fall back to text-only guidance.

## Implementation Notes

Budget-sensitive: no bulk or live generation jobs without explicit user approval.

## Progress Notes

- Added a safe framing preview API at `/api/studio/framing-presets/[id]/preview`.
- The endpoint renders a scoped OpenPose control PNG from stored pose keypoints and the selected framing transform without launching a generation job.
- Preview cleanup is scoped to `public/generations/studio-sessions/framing-previews/{workspaceId}/{presetId}` and cannot delete normal shot result assets.
- The Framing Library editor now has a Pose + framing test panel that selects workspace poses, renders control previews, and clearly shows text-only fallback when OpenPose data is missing.
- Added explicit two-step Z-Image ControlNet preview launch: the UI asks for browser confirmation, then the preview API requires `confirmLaunch: true` before submitting a RunPod job.
- The launch path reuses the rendered scoped control PNG as the secure Z-Image ControlNet input, records framing/pose context, and adds the queued preview job to the UI.
- No live preview job was launched during implementation/testing.
