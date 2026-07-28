# ENGUI-470 - Spread carousel shuffle across gallery order

## Problem

Carousel shuffle can still place gallery-neighboring images close together because a uniform random permutation does not enforce source-order distance, and image slots currently pick visually similar images without considering gallery proximity.

## Scope

- Shared desktop and mobile Carousel shuffle mode.
- `/api/carousel/feed-window?source=shuffle`.
- Server-side feed construction helpers in `src/lib/galleryVideoCarousel.ts`.

## Acceptance Criteria

- [x] Shuffle mode keeps deterministic seed behavior across before/after window requests.
- [x] Shuffle mode spreads assets from different source-order regions instead of using plain Fisher-Yates for the final feed order.
- [x] Image slots avoid packing gallery-neighboring images together when a wider candidate pool exists.
- [x] Gallery View order remains unchanged.
- [x] Focused tests cover spread behavior and stable seed pagination.

## Result

Implemented spread shuffle for server-side Carousel shuffle feeds. The shared helper now interleaves source-order bands with the existing seeded random function and repairs nearby gallery-order neighbors when possible. Image slots use the same spread mode and avoid grouping source-neighboring images when enough candidates exist. Gallery View remains on the gallery-order path.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify Carousel shuffle returns to the previous seeded Fisher-Yates behavior.
