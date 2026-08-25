---
id: ENGUI-530
title: Add desktop Flow carousel mode
status: Done
assignee: []
created_date: '2026-08-24 23:51'
labels:
  - gallery
  - desktop
  - carousel
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a separate desktop Flow mode beside the current carousel. Flow uses carousel filters but builds its own ordered/random queue, drives portrait and landscape slot layouts, persists profile-ready settings, and supports pause/previous/next controls.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Desktop Gallery Carousel exposes a separate Flow mode beside the existing carousel.
- [x] #2 Flow filters out square/unknown-ratio assets and builds portrait 3xN plus landscape 4xM blocks with ordered or Flow-random order.
- [x] #3 Flow persists profile-ready settings for portrait cycles, landscape cycles, image interval, and order mode.
- [x] #4 Flow supports muted autoplay video, poster-first video loading without a loader, pause queue processing, and previous/next wrap-around navigation.
- [x] #5 Focused tests cover Flow queue construction and settings normalization.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rollback: revert implementation commit, run npm run build, and restart engui-studio.service.

2026-08-25 follow-up: Flow video auto-advance must not depend only on readable duration metadata. The active Flow video advances the queue on its `ended` event, with the duration timer kept as a fallback. The Flow settings panel opens from a dedicated right-edge hover target instead of only sharing the top controls hover area.

2026-08-25 portrait layout follow-up: Flow portrait mode uses exactly three equal-width screen slots. Portrait media is contained and centered inside each slot so videos play at full height without overlapping neighboring slots.

2026-08-25 playback lifecycle follow-up: Flow video `ended` now advances the queue only when it belongs to the latest activated slot, then restarts that visible video locally. Older visible slots keep replaying in place without triggering additional queue advances.

2026-08-25 next-slot timer follow-up: Flow settings now use a `Next slot` activation slider from 3 to 10 seconds. Auto-advance is timer-driven for videos and images, independent of video duration; video `ended` only restarts the visible video locally.
<!-- SECTION:NOTES:END -->
