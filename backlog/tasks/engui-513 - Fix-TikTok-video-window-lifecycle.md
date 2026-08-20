# ENGUI-513 - Fix TikTok video window lifecycle

Status: Done
Created: 2026-08-20T20:12:52Z
Finished: 2026-08-20T20:27:00Z

## Goal

Make mobile TikTok carousel slots follow a strict media lifecycle: current video plays, `+/- 1` videos preload and play immediately after snap, `+/- 2` and `+/- 3` show only first-frame posters, and anything outside `+/- 3` is fully cleared.

## Scope

- Mobile TikTok carousel mode in `GalleryVideoCarousel`.
- Preserve normal carousel behavior.

## Acceptance Criteria

- [x] Current TikTok video starts playback when it becomes centered, even if it was previously paused as a neighbor.
- [x] Adjacent `+/- 1` videos stay mounted as `<video preload="auto">` and are preloaded without autoplaying while offscreen.
- [x] `+/- 2` and `+/- 3` slots render poster-only first-frame layers without loading video sources.
- [x] Slots beyond `+/- 3` are removed so their video refs and pending load/play state are cleared.
- [x] Poster-only frames are displayed without zoom/cropping.
- [x] Focused tests cover current-play retry, neighbor preload, poster-only lookahead, and cleanup.

## Result

Implemented on 2026-08-20.

- TikTok playback retry now targets only the centered slot, so preloaded offscreen neighbors stay paused but the centered neighbor receives a fresh `play()` request after snap.
- Removed video elements are paused, have their `src` removed, and call `load()` before their refs and pending preload/play state are cleared.
- Poster-only `+/- 2` and `+/- 3` slots use contained first-frame rendering to avoid zoom/cropping while still avoiding full video loads.
- Validation passed: focused carousel Vitest, targeted ESLint with existing warnings only, `git diff --check`, Prisma validate, production build, service restart, and smoke checks.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify `/m/carousel`.
