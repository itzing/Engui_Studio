# ENGUI-515 - Add TikTok video load progress

Status: Done
Created: 2026-08-20T20:49:00Z
Finished: 2026-08-20T20:57:00Z

## Goal

Improve mobile TikTok carousel loading states with a visible circular preload progress indicator, better first-video behavior, and wider poster-only lookahead.

## Scope

- Mobile TikTok carousel mode in `GalleryVideoCarousel`.
- Preserve non-TikTok carousel behavior.

## Acceptance Criteria

- [x] Initial current TikTok video shows a loader on black instead of the gallery asset thumbnail while it loads.
- [x] Swiping to an unloaded TikTok video with a poster shows that poster with a visible circular loader overlay.
- [x] The loader displays real buffered progress when the browser exposes it, with a visible fallback while progress is unknown.
- [x] Loader disappears once the video can play and playback starts.
- [x] Poster-only lookahead covers neighbors from `+/- 2` through `+/- 5`.
- [x] Slots beyond `+/- 5` are not mounted and any video load state is cleared.
- [x] Focused tests cover loader/progress, initial-poster behavior, widened poster lookahead, and cleanup.

## Result

Implemented on 2026-08-20.

- TikTok now keeps a `+/- 5` mounted window, with only current and `+/- 1` rendered as preloadable video elements.
- Initial current video suppresses the gallery thumbnail layer and shows the circular loader on black until the video can play.
- Swipe-target videos keep their poster visible while not ready and show a circular conic progress loader above it.
- Progress reads `video.buffered / duration` when available and falls back to a visible starter progress state.
- Video progress state is cleared when slots leave the mounted window.
- Validation passed: focused carousel Vitest, targeted ESLint with existing warnings only, `git diff --check`, Prisma validate, production build, service restart, and smoke checks.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify `/m/carousel`.
