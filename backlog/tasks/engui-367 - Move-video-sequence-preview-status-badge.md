---
id: engui-367
title: Move video sequence preview status badge
status: Done
created: 2026-07-09
updated: 2026-07-09
---

## Goal

Move the stitched sequence preview play/pause status icon to the top-right corner and keep the preview image unobscured when the icon is visible.

## Acceptance Criteria

- [x] The play/pause status indicator appears in the top-right corner of the preview.
- [x] Showing the status indicator does not dim or darken the preview video.
- [x] Clicking the preview still toggles play/pause.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

The stitched sequence preview now shows the play/pause status as a compact top-right badge. The previous full-surface hover overlay was removed, so the preview video is not dimmed when the status icon is visible.
