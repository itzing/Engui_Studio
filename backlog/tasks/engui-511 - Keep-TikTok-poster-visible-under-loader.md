# ENGUI-511 - Keep TikTok poster visible under loader

Status: Done
Created: 2026-08-20T19:51:00Z
Finished: 2026-08-20T19:53:00Z

## Goal

Fix mobile TikTok carousel loading so the first frame/poster remains visible until the video is ready, with the loading spinner layered on top instead of replacing the frame with a black screen.

## Scope

- Mobile TikTok carousel mode in `GalleryVideoCarousel`.
- Keep normal carousel rendering unchanged.

## Acceptance Criteria

- [x] TikTok video slots render a poster/thumbnail layer while the video is not ready.
- [x] The spinner appears above the poster layer.
- [x] The poster layer disappears only after the video reports ready.
- [x] Normal carousel video rendering remains unchanged.

## Result

Implemented on 2026-08-20.

- TikTok loading slots now render the thumbnail/poster as an explicit image layer above the video while the video is not ready.
- The loading spinner is layered above that poster, so the screen no longer flashes to black while waiting for video decode.
- The poster layer is removed after `loadeddata` or `canplay` marks the video ready.
- Validation passed: focused shared/mobile carousel Vitest, targeted ESLint with existing warnings only, `git diff --check`, and Prisma validate.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify `/m/carousel`.
