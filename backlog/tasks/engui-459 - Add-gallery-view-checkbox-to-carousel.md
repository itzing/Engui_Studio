# ENGUI-459 - Add Gallery View checkbox to Carousel

Status: Done
Created: 2026-07-27

## Goal

Replace the mobile/iPad Gallery entry-button handoff with a single `Gallery View` checkbox in Carousel settings on desktop, phone, and iPad.

## Scope

- Shared `GalleryVideoCarousel` settings and feed selection.
- Desktop Gallery Carousel controls.
- Mobile/iPad `/m/carousel` settings screen.
- Remove the old added Carousel buttons from mobile/iPad Gallery.

## Acceptance Criteria

- Desktop, phone, and iPad carousel settings expose a `Gallery View` checkbox.
- When `Gallery View` is off, the existing shuffle feed is used.
- When `Gallery View` is on, the carousel builds a feed in gallery order anchored to the current or last selected Gallery asset.
- Existing carousel settings still apply: Videos, Images, Landscape, Portrait, Only favorites, Speed, and Scrub.
- Image assets in `Gallery View` render one image per slot in gallery order, not five images per slot.
- The old mobile/iPad Gallery Carousel buttons and query handoff are removed.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify `/`, `/m/gallery`, and `/m/carousel`.

## Result

Implemented on 2026-07-27.

- Added persisted `Gallery View` to Carousel settings on desktop and mobile/iPad.
- `Gallery View` off keeps the existing shuffle feed.
- `Gallery View` on uses gallery-order playback anchored to the selected desktop Gallery asset or the last selected mobile Gallery asset.
- Existing Carousel filters/settings continue to apply.
- Gallery View image assets render as one image per slot in gallery order.
- Removed the previously added mobile/iPad Gallery Carousel buttons and query handoff.
