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
<!-- SECTION:NOTES:END -->
