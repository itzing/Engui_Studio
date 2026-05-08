---
id: ENGUI-302
title: Compose framed OpenPose guidance for Studio runs
status: Done
assignee: []
created_date: '2026-05-08 15:49'
labels:
  - studio-sessions
  - openpose
  - framing
  - controlnet
priority: high
dependencies: []
completed_date: '2026-05-08 16:03'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a Studio run shot has a selected pose with an OpenPose PNG and a framing preset, generation must create a new framed guidance PNG from the pose OpenPose image and resolved framing transform, then pass that composed PNG as the Z-Image ControlNet condition image. The raw pose OpenPose PNG should not be passed directly when framing is present.
<!-- SECTION:DESCRIPTION:END -->

## Scope

- Backend/generation slice only.
- Use pose `openPoseImageUrl` as the source guidance image.
- Compose source OpenPose pixels into the resolved output canvas with framing scale, center, rotation, and flip.
- Pass composed guidance as `condition_image` through existing z-image ControlNet path.
- Keep keypoint JSON fallback if available.
- Do not launch paid/live generation jobs during validation.

## Resolution

- Studio run generation now prefers the pose OpenPose PNG and composes it into a new per-shot guidance PNG using the resolved framing preset.
- The composed guidance PNG is saved under `public/generations/studio-sessions/openpose-controls/...` and passed through the existing Z-Image ControlNet `condition_image` path.
- Keypoint JSON rendering remains as fallback when no local OpenPose PNG is available.
- Validation: `npm run build` passed; local compose smoke generated `/tmp/framed-openpose-guidance-test.png` at 832x1216 from a real pose OpenPose PNG. No live generation jobs were launched.
