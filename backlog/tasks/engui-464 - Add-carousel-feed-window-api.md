# ENGUI-464 - Add carousel feed window API

## Status

Done

## Description

Generalize carousel feed loading behind a dedicated server endpoint. The endpoint should accept carousel parameters and return a working window, not a full gallery list. `Gallery View` should start from this window and prefetch additional pages in both directions while the user scrolls.

## Scope

- `/api/carousel/feed-window`
- Shared `GalleryVideoCarousel`
- Desktop and mobile/iPad Carousel through the shared player
- Focused API and component tests

## Acceptance Criteria

- [x] Carousel has a dedicated feed-window endpoint separate from `/api/gallery/assets`.
- [x] The endpoint accepts carousel media, orientation, favorite, anchor, and gallery context parameters.
- [x] `Gallery View` starts from a server-returned window without loading every gallery page first.
- [x] Scrubbing near either edge prefetches and merges the next before/after window.
- [x] Existing shuffle mode still works.

## Implementation Plan

1. Add the endpoint and tests for anchor-centered gallery-order windows.
2. Change `GalleryVideoCarousel` Gallery View loading to call the endpoint.
3. Add client-side before/after window merge.
4. Run focused tests, build, restart, and smoke checks.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify the previous Gallery View loading path returns.

## Result

Implemented on 2026-07-27.

- Added `/api/carousel/feed-window` for anchor-centered carousel windows.
- `Gallery View` now starts from the server-returned window and no longer waits for every gallery page.
- The shared player prefetches and merges before/after windows while scrubbing near loaded edges.
- Shuffle mode keeps its existing full-feed behavior.
- Validation passed: focused API/shared/mobile carousel Vitest, targeted ESLint, `git diff --check`, Prisma validate, and production build.
