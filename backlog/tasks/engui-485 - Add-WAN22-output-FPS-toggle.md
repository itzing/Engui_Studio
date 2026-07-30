---
id: engui-485
title: Add WAN22 output FPS toggle
status: Done
labels: [wan22, video, mobile, desktop, video-sequences]
---

## Goal

Allow Wan 2.2 I2V users to assemble generated frames at either 16fps or 32fps. The 32fps mode intentionally plays the same generated frame count twice as fast.

## Acceptance Criteria

- [x] Desktop and mobile Create Video expose a Wan 2.2 `FPS` control with 16 and 32 options.
- [x] Wan 2.2 submit payloads include the selected FPS value.
- [x] Drafts and video presets preserve the selected FPS.
- [x] Video Sequence Builder exposes one global sequence-level FPS setting instead of a per-segment setting.
- [x] Video Sequence segment generation sends the global FPS to the endpoint and keeps frame-count derivation based on the same sequence target.
- [x] Focused tests cover payload and sequence behavior.

## Notes

Endpoint support is tracked separately in `wan22-12` on the DaSiWa endpoint branch.
