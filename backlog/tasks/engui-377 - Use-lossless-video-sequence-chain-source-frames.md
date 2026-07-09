---
id: engui-377
title: Use lossless video sequence chain source frames
status: Done
created: 2026-07-09
updated: 2026-07-09
---

## Goal

Reduce chained Video Sequence Builder quality loss by using lossless source frames and avoiding the blur-prone final frame as the automatic continuation source.

## Acceptance Criteria

- [x] Extract completed segment first/source-chain frames as PNG instead of JPEG.
- [x] Use a frame about 3 seconds before the end of the previous segment as the automatic continuation frame when possible.
- [x] Preserve first-frame preview and manual frame picker behavior.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

Completed segment frame extraction now writes PNG frames. The continuation frame stored in `lastFrameUrl` is extracted from `duration - 3s` when the segment is longer than 3 seconds, falling back to the actual last frame for shorter clips.
