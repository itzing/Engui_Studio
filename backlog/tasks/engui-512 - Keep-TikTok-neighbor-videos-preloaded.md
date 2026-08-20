# ENGUI-512 - Keep TikTok neighbor videos preloaded

Status: Done
Created: 2026-08-20T19:58:00Z
Finished: 2026-08-20T20:01:00Z

## Goal

Improve mobile TikTok carousel media lifecycle so adjacent videos stay loaded across back-and-forth swipes and begin playing immediately when they become current.

## Scope

- Mobile TikTok carousel mode in `GalleryVideoCarousel`.
- Preserve normal carousel behavior.

## Acceptance Criteria

- [x] TikTok slots keep stable identities across snaps instead of remounting already seen videos.
- [x] Previous/next videos (`+/- 1`) stay mounted and use full video preload.
- [x] Poster-only lookahead slots (`+/- 2` and `+/- 3`) keep first frames visible without loading full videos.
- [x] Returning to the previous video does not force it to reload from a black/spinner state.
- [x] Focused tests cover stable neighbor preload and poster-only lookahead.

## Result

Implemented on 2026-08-20.

- TikTok slot keys now stay stable by asset id, so already mounted previous/next videos are not remounted after a snap.
- TikTok keeps a wider `+/- 3` window: `+/- 1` render real video elements with `preload="auto"` and an explicit `load()` request, while `+/- 2` and `+/- 3` render poster-only first-frame layers.
- Ready video state is preserved across TikTok snaps, preventing a previously loaded neighbor from falling back to the loading poster/spinner when swiping back.
- Validation passed: focused shared/mobile carousel Vitest, targeted ESLint with existing warnings only, `git diff --check`, and Prisma validate.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify `/m/carousel`.
