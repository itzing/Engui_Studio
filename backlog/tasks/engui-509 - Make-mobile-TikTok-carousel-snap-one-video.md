# ENGUI-509 - Make mobile TikTok carousel snap one video

Status: Done
Created: 2026-08-20T19:16:00Z
Finished: 2026-08-20T19:25:00Z

## Goal

Correct mobile TikTok mode so it behaves like a snap viewer: one portrait video is shown fullscreen, it does not auto-move, and each vertical swipe advances exactly one video up or down.

## Scope

- Mobile `/m/carousel` TikTok mode.
- Shared `GalleryVideoCarousel` only where needed behind the TikTok flag.
- Keep normal carousel behavior unchanged.

## Acceptance Criteria

- [x] TikTok mode renders one active video slot at a time.
- [x] The active slot is stationary and fills the portrait viewport.
- [x] Swipe up advances exactly one video.
- [x] Swipe down returns exactly one video.
- [x] Horizontal swipe still exits TikTok mode from the mobile overlay.

## Result

Implemented on 2026-08-20.

- TikTok mode now forces video-only, portrait-only playback.
- The shared carousel renders a single fullscreen, stationary slot under the TikTok flag.
- Vertical swipes snap to the previous/next feed item only on pointer release, one item per swipe.
- Normal carousel movement remains unchanged outside TikTok mode.
- Validation passed: focused mobile/shared carousel Vitest, targeted ESLint with existing warnings only, `git diff --check`, Prisma validate, production build, service restart, and smoke checks.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify `/m/carousel`.
