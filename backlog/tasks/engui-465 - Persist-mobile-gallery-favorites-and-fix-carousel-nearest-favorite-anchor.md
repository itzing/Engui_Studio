# ENGUI-465 - Persist mobile gallery favorites and fix carousel nearest favorite anchor

## Status

Done

## Description

Mobile Gallery should remember the favorites-only filter per workspace, and Gallery View carousel startup should choose the nearest matching favorite asset when the selected gallery asset is not itself a favorite.

## Scope

- Mobile `/m/gallery` filter persistence.
- `/api/carousel/feed-window` anchor resolution.
- Focused hook/API/component regression tests.

## Acceptance Criteria

- [x] Mobile Gallery restores the favorites-only filter after leaving and returning to `/m/gallery`.
- [x] Mobile Gallery persists favorites-only per workspace.
- [x] Carousel Gallery View with `favoritesOnly=true` and a non-favorite `anchorAssetId` starts from the nearest favorite in gallery order, not index 0.
- [x] Existing carousel media/orientation filtering behavior remains unchanged.

## Implementation Plan

1. Add per-workspace mobile gallery favorites persistence in the shared gallery hook.
2. Adjust feed-window anchor resolution so the source order can still locate non-favorite anchors before applying carousel-only favorites filtering.
3. Add focused regressions for persisted mobile favorites and nearest favorite anchor selection.
4. Run focused tests, build, restart service, smoke check, commit, and push.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify mobile Gallery and Carousel return to the previous behavior.

## Result

Implemented on 2026-07-27.

- Mobile Gallery favorites-only state is persisted per workspace.
- Carousel feed-window keeps the anchor's gallery-order position available before applying the favorites-only playable feed filter.
- Added regressions for mobile favorites persistence and non-favorite anchor to nearest favorite startup.
- Validation passed: focused hook/API/shared/mobile carousel tests, targeted ESLint, `git diff --check`, Prisma validate, and production build.
