# ENGUI-508 - Add mobile TikTok carousel mode

Status: Done
Created: 2026-08-20T18:59:00Z
Finished: 2026-08-20T19:10:00Z

## Goal

Add a mobile-only TikTok mode to Gallery Carousel settings. When enabled and started, the carousel opens in portrait, uses the selected subset, moves with vertical swipes, and closes with a horizontal left/right swipe.

## Scope

- Mobile `/m/carousel` settings only.
- Persist the TikTok mode checkbox with the existing per-workspace carousel settings.
- Force TikTok playback to portrait-oriented assets and a portrait viewer.
- Keep vertical swipes for feed movement and horizontal swipes for exit.

## Acceptance Criteria

- [x] Mobile carousel settings include a `TikTok mode` checkbox.
- [x] Starting with TikTok mode opens the fullscreen player in portrait without the rotate-phone gate.
- [x] TikTok mode passes portrait-only ratio settings to the carousel player.
- [x] Vertical swipe keeps the player open and scrubs the feed.
- [x] Left/right swipe closes the player.

## Result

Implemented on 2026-08-20.

- Mobile Gallery Carousel settings now persist `TikTok mode`.
- TikTok mode launches the shared carousel as a portrait-only vertical player while preserving the selected media subset filters.
- Horizontal swipe closes TikTok mode; vertical swipes remain available for feed movement.
- Validation passed: focused mobile/shared carousel Vitest, targeted ESLint with existing warnings only, `git diff --check`, Prisma validate, production build, service restart, and smoke checks.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify `/m/carousel` returns to its previous landscape/portrait behavior.
