# engui-518 - Reconcile TikTok video and poster window on swipe

## Goal

Keep mobile TikTok carousel slots visually covered while swiping quickly:

- current and +/-1 slots must have video elements mounted and preloading
- +/-2 through +/-5 slots must have poster thumbnails available
- slots at distance 6+ must be cleaned up
- each swipe/snap should reconcile the window and trigger targeted poster backfill for missing poster data

## Scope

- Mobile TikTok carousel behavior in `GalleryVideoCarousel`
- Focused regression tests for the TikTok window lifecycle

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and smoke `/m/carousel`.
