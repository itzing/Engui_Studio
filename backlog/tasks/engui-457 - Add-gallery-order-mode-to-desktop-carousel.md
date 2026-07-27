# ENGUI-457 - Add gallery order mode to desktop carousel

Status: Done
Created: 2026-07-27

## Goal

Open the desktop Gallery Carousel as a gallery viewer mode that starts from the currently selected gallery asset and follows neighboring assets in gallery order instead of shuffling.

## Scope

- Desktop Gallery Overlay carousel entry.
- Shared Gallery Carousel feed construction.
- Preserve existing carousel controls for media type, orientation, favorites, speed, scrub, pause, and refresh.
- Leave `/m/carousel` behavior unchanged unless explicitly requested.

## Acceptance Criteria

- Opening Carousel from the desktop gallery starts at the selected gallery asset when it passes current carousel filters.
- The next and previous carousel slots follow gallery order rather than randomized order.
- Existing filters and settings continue to rebuild the feed.
- Focused tests cover gallery order and anchor behavior.

## Result

Implemented on 2026-07-27.

- Desktop Gallery Overlay opens Gallery Carousel in `galleryOrder` mode.
- The carousel receives the currently selected gallery asset and starts playback from that asset when it survives the active carousel filters.
- Gallery-order mode fetches gallery assets in API order with the desktop gallery context: bucket, search query, favorites, and trash filters.
- Carousel controls still apply videos/images, orientation, favorites, speed, scrub, pause, refresh, and restart behavior.
- `/m/carousel` keeps the existing shuffle-style feed.
