# ENGUI-466 - Move shuffle carousel to feed-window

## Status

Done

## Context

Shuffle mode still loads every matching gallery asset through paginated `/api/gallery/assets` calls before building the carousel feed in the browser. The gallery assets API currently normalizes the full matching list for each page, so shuffle startup performs repeated full scans and sends megabytes of JSON to the client.

## Scope

- `/api/carousel/feed-window`
- Shared desktop/mobile `GalleryVideoCarousel`
- Focused API and component regression tests

## Acceptance Criteria

- [x] Shuffle mode loads its initial feed window through `/api/carousel/feed-window`.
- [x] Shuffle mode uses a stable seed so before/after window requests preserve the same randomized order.
- [x] The Shuffle action creates a new randomized order without reloading every asset into the browser.
- [x] Gallery View behavior remains unchanged.
- [x] Desktop and mobile carousel surfaces use the shared implementation.

## Result

Implemented `source=shuffle` in `/api/carousel/feed-window` with deterministic seed support and moved non-Gallery View `GalleryVideoCarousel` loading to the feed-window endpoint. Shuffle startup and prefetch now return ready windows instead of loading every gallery asset into the browser. Gallery View keeps its existing `source=galleryOrder` behavior.

## Implementation Plan

1. Extend `/api/carousel/feed-window` with `source=shuffle` and a returned `seed`.
2. Build the shuffled feed server-side using the existing carousel feed helper and a deterministic seeded RNG.
3. Reuse the existing window/cursor response shape for shuffle startup and before/after prefetch.
4. Update `GalleryVideoCarousel` non-Gallery View loading to use the feed-window endpoint.
5. Add focused regression tests for shuffle source, stable seed pagination, and client requests.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify shuffle mode returns to the previous `/api/gallery/assets` full-feed loading path.
