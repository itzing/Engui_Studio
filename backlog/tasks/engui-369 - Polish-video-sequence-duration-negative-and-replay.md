---
id: engui-369
title: Polish video sequence duration, negative field, and replay
status: Done
created: 2026-07-09
updated: 2026-07-09
---

## Goal

Polish the desktop Video Sequence Builder defaults and stitched preview playback behavior.

## Acceptance Criteria

- [x] New video sequence segments default to `5` seconds.
- [x] New video segment templates default to `5` seconds.
- [x] The Segment inspector no longer shows the Negative prompt field.
- [x] Clicking the stitched preview after it reaches the end restarts playback from the first completed segment.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

New Video Sequence Builder segments and segment templates now default to five seconds, the desktop Segment inspector no longer exposes the Negative prompt field, and the stitched preview restarts from the first completed segment when clicked after reaching the end.
