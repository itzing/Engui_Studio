# ENGUI-462 - Start Gallery View at nearest matching asset

## Status

Done

## Description

When Carousel starts in `Gallery View` from the middle of the gallery, choose the nearest asset that matches the current carousel filters. If the current gallery asset is filtered out by media type, orientation, or favorites, the player should not fall back to the far end of the filtered feed.

## Scope

- Shared `GalleryVideoCarousel` gallery-order anchor selection.
- Desktop and mobile/iPad Carousel through the shared player.
- Focused regression tests.

## Acceptance Criteria

- [x] If the current gallery asset matches the carousel filters, Gallery View starts from it.
- [x] If the current gallery asset is filtered out, Gallery View starts from the nearest matching asset by gallery order position.
- [x] Existing neighbor seeding still mounts both adjacent sides around the resolved start slot.

## Implementation Plan

1. Resolve the current gallery asset position in the full ordered gallery response.
2. Build the filtered Gallery View feed with source-order indices.
3. Choose the exact current asset when present, otherwise choose the filtered entry with the smallest source-order distance.
4. Add a focused regression test, then run build, restart, and smoke checks.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify the previous fallback behavior returns.

## Result

Implemented on 2026-07-27.

- Gallery View now keeps source-order indices while filtering by media type, ratio, and favorites.
- If the selected gallery asset is filtered out, the player starts from the nearest matching filtered asset instead of falling back to the first feed entry.
- Validation passed: focused shared/mobile carousel Vitest, targeted ESLint, `git diff --check`, Prisma validate, and production build.
