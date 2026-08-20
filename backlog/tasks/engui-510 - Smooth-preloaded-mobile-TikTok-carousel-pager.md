# ENGUI-510 - Smooth preloaded mobile TikTok carousel pager

Status: Done
Created: 2026-08-20T19:33:07Z
Finished: 2026-08-20T19:39:00Z

## Goal

Make mobile TikTok carousel mode behave like a pager with preloaded adjacent videos: the current portrait video stays still while watched, neighbors are ready around it, and a vertical swipe smoothly moves one video offscreen while the next one enters.

## Scope

- Mobile `/m/carousel` TikTok mode.
- Shared `GalleryVideoCarousel` behavior behind the TikTok flag.
- Keep the normal carousel unchanged.

## Acceptance Criteria

- [x] Current, previous, and next TikTok videos are mounted when available.
- [x] While idle, only the current video fills the screen.
- [x] Dragging up moves the current video upward while the next video enters from below.
- [x] Dragging down moves the current video downward while the previous video enters from above.
- [x] Releasing a valid swipe animates exactly one video into place.
- [x] Adjacent videos use poster/first-frame preload and show a spinner until playable.

## Result

Implemented on 2026-08-20.

- TikTok mode now keeps the previous, current, and next portrait videos mounted when available.
- Idle layout keeps the current video at `0px`, the previous video one viewport above, and the next video one viewport below.
- Vertical drag translates the mounted slots together, so the incoming video follows the finger instead of appearing only after release.
- Release snaps one item with a short transform animation, then recenters on the new active video.
- TikTok videos use `preload="auto"`, poster thumbnails, and a loading spinner until the video can play.
- Validation passed: focused shared/mobile carousel Vitest, targeted ESLint with existing warnings only, `git diff --check`, and Prisma validate.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify `/m/carousel`.
