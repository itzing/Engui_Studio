# ENGUI-458 - Extend gallery order carousel to mobile and iPad

Status: Done
Created: 2026-07-27

## Goal

Let mobile and iPad Gallery open Carousel from the currently selected gallery asset and play neighboring assets in gallery order instead of shuffle.

## Scope

- Mobile and tablet `/m/gallery` carousel entry.
- Mobile `/m/carousel` handoff from Gallery.
- Preserve direct `/m/carousel` shuffle behavior.
- Preserve carousel settings and filters for media type, orientation, favorites, speed, scrub, pause, restart, and mobile orientation gates.

## Acceptance Criteria

- Mobile Gallery exposes a Carousel action when an image or video asset is selected.
- Tablet/iPad Gallery exposes the same Carousel action in the tablet toolbar.
- Opening Carousel from Gallery starts with `galleryOrder` playback anchored to the selected asset.
- The gallery order context includes current bucket/search/favorites/trash filters.
- Direct `/m/carousel` still starts with the existing shuffle feed.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify `/m/gallery` and `/m/carousel`.

## Result

Implemented on 2026-07-27.

- Mobile and tablet Gallery now show a Carousel action for selected image/video assets.
- The Gallery Carousel action opens `/m/carousel` in `galleryOrder` mode with the selected asset as the anchor.
- The handoff keeps gallery context for bucket, search query, favorites, and trash filters.
- Mobile `/m/carousel` auto-starts for gallery handoffs, while direct `/m/carousel` keeps the existing shuffle feed and settings screen.
- Existing mobile orientation gates and carousel settings remain active.
