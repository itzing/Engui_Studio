# ENGUI-465 - Anchor carousel to visible gallery window

## Status

Done

## Description

Opening Gallery Carousel from a scrolled gallery should start near the visible gallery position, not fall back to index zero when no tile is explicitly selected.

## Scope

- Desktop Gallery overlay Carousel open action
- Anchor handoff into shared `GalleryVideoCarousel`
- Focused regression tests

## Acceptance Criteria

- [x] Carousel open uses the selected visible asset when it is visible.
- [x] If no selected asset is visible, Carousel uses an asset near the center of the current virtualized gallery viewport.
- [x] Gallery View still starts paused with neighbors on both sides.
- [x] Existing mobile direct Carousel last-viewed behavior remains intact.

## Implementation Plan

1. Resolve a Carousel anchor from the current visible gallery rows before opening the modal.
2. Store that anchor for the modal lifetime and pass it as `currentGalleryAssetId`.
3. Add regression coverage for opening Carousel from a scrolled, unselected gallery viewport.
4. Run focused tests, build, restart, and smoke checks.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify Carousel returns to the previous anchor behavior.

## Result

Implemented on 2026-07-27.

- Desktop Gallery Carousel now resolves an anchor when opening: it prefers the selected asset only if it is inside the current visible gallery range, otherwise it uses the loaded asset nearest the center of the visible virtualized rows.
- The resolved anchor is held for the modal lifetime and passed to `GalleryVideoCarousel`.
- Added regression coverage for a stale selected asset while the user is scrolled to the middle of the gallery.
