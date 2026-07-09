---
id: engui-368
title: Add accurate video sequence output metadata
status: Done
created: 2026-07-09
updated: 2026-07-09
---

## Goal

Use actual segment output video metadata for stitched preview timing and show precise frame/FPS/duration details on segment cards.

## Acceptance Criteria

- [x] The stitched preview timeline uses the completed output video's actual duration instead of the planned segment duration.
- [x] Scrubber time labels show seconds precisely enough to diagnose short clips.
- [x] Completed segment cards show frame count, FPS, and exact duration in the format `81f / 16fps / 5.06s`.
- [x] Segments without output metadata still fall back to the planned duration.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

Segment output videos now carry actual metadata from `ffprobe`, including duration, FPS, and frame count. The stitched preview timeline uses the real completed output duration, the scrubber works at hundredth-second precision, and segment cards show output details such as `81f / 16fps / 5.06s` when metadata is available.
