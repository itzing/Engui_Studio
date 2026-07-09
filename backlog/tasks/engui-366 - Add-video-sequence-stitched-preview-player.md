---
id: engui-366
title: Add video sequence stitched preview player
status: Done
created: 2026-07-09
updated: 2026-07-09
---

## Goal

Make desktop Video Sequence Builder prioritize a large preview player for the stitched sequence made from completed segment outputs, while keeping segment cards and the timeline available for navigation below it.

## Acceptance Criteria

- [x] The main center area shows a large sequence preview player above the segment cards.
- [x] The preview plays completed segment `outputVideoUrl` values in order as a single stitched preview.
- [x] A scrubber slider seeks across the combined preview timeline.
- [x] Clicking the preview toggles play/pause.
- [x] Segment cards move below the preview and stay above the existing bottom timeline.
- [x] The bottom timeline remains available for fast navigation.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

Desktop Video Sequence Builder now puts a large stitched preview player in the primary center area. The preview uses completed segment outputs in order as one continuous playback surface, with a combined scrubber slider and click-to-play/pause behavior. Segment cards moved into a horizontal strip directly above the existing bottom timeline, and both segment cards and timeline buttons still select and seek to matching completed preview segments when available.
