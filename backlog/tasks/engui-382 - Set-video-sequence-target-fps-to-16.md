---
id: engui-382
title: Set video sequence target FPS to 16
status: Done
labels: [desktop, video-sequences, wan22, generation]
---

## Goal

Make Video Sequence Builder duration-to-frame conversion match the WAN2.2 endpoint output frame rate.

## Acceptance Criteria

- [x] New video sequences default `targetFps` to `16`.
- [x] Server sequence creation falls back to `16` when no `targetFps` is provided.
- [x] Duration-based WAN22 segment generation can produce `16 * duration` frame counts, including `80` frames for `5s`.
- [x] Existing local video sequences that still have `targetFps = 24` are updated to `16`.
- [x] Verify whether the WAN2.2 endpoint accepts an FPS parameter or uses the ComfyUI workflow FPS.
- [x] Focused tests, production build, service restart, and smoke checks pass.

## Notes

Rollback: revert the Engui commit, restore the previous `targetFps` default if needed, rebuild, and restart `engui-studio.service`.

## Result

Changed `VideoSequence.targetFps` defaults from `24` to `16`, changed the server fallback to `16`, and allowed sequence-derived `length` to be `80` frames for a `5s` WAN2.2 segment. Updated the local SQLite rows that still had `targetFps = 24` to `16`.

WAN2.2 endpoint check: Engui sends `length`, not a target FPS. The endpoint ComfyUI workflows set `VHS_VideoCombine.frame_rate` to `16`, so output FPS is workflow-defined.
