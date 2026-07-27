# Gallery View nearest anchor

## Goal

When Carousel opens in `Gallery View`, start from the nearest asset that matches the active carousel filters relative to the user's current gallery position.

## Problem

The existing Gallery View feed finds the current gallery asset only after applying carousel filters. If that asset is filtered out, playback falls back to index `0`, which can be the farthest matching item from the user's current gallery position.

## Plan

1. Keep the full ordered gallery response as the source of gallery positions.
2. Build the filtered feed together with each entry's source-order index.
3. If the selected gallery asset survives filtering, start from it.
4. Otherwise, start from the filtered entry with the smallest distance from the selected asset's source-order index, preferring the next matching item on exact ties.
5. Preserve the existing initial neighbor seeding around the resolved start slot.

## Validation

- Focused `GalleryVideoCarousel` tests.
- Targeted ESLint for changed files.
- `git diff --check`.
- `npx prisma validate`.
- Production build, service restart, and smoke checks.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify the previous fallback behavior returns.
