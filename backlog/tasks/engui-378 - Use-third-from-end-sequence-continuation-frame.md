---
id: engui-378
title: Use third-from-end sequence continuation frame
status: Done
created: 2026-07-09
updated: 2026-07-09
---

## Goal

Use a near-final frame for automatic Video Sequence Builder continuation without jumping three seconds back in time.

## Acceptance Criteria

- [x] Extract the automatic continuation frame from about 3 frames before the end when output duration and FPS are known.
- [x] Fall back to the true last frame when duration/FPS metadata is unavailable or too short.
- [x] Keep PNG/lossless source-frame behavior from `engui-377`.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

Automatic continuation extraction now uses `duration - 3/fps`, so the source frame is about three frames before the end. If duration or FPS metadata is missing or invalid, extraction falls back to the true last frame.
