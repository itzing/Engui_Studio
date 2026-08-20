# ENGUI-516 - Fix TikTok poster-only gallery thumbnail fallback

Status: Done
Created: 2026-08-20T21:04:13Z
Finished: 2026-08-20T21:17:18Z

## Goal

Prevent mobile TikTok poster-only slots from showing ordinary gallery thumbnails when a video poster derivative is not ready yet.

## Scope

- Mobile TikTok carousel mode in `GalleryVideoCarousel`.
- Carousel feed metadata needed to distinguish ready video posters from gallery thumbnail fallbacks.
- Preserve non-TikTok carousel behavior.

## Acceptance Criteria

- [x] TikTok poster-only slots use only ready video poster derivatives as poster layers.
- [x] If a nearby TikTok slot has no ready poster, it shows black background with the circular loader instead of the gallery asset thumbnail.
- [x] Nearby TikTok video assets trigger poster derivative backfill so poster-only slots can catch up quickly.
- [x] Focused tests cover pending poster fallback and backfill triggering.

## Result

Implemented on 2026-08-20.

- Carousel feed items now include `derivativeStatus`, letting TikTok distinguish completed first-frame video posters from pending gallery thumbnail fallbacks.
- TikTok poster layers use only completed video poster thumbnails; pending or stale thumbnails are not shown as posters.
- Nearby TikTok slots with missing ready posters request targeted derivative backfill and merge returned poster URLs back into the active feed without a full reload.
- Validation passed: focused carousel/API/derivative Vitest, targeted ESLint with existing warnings only, `git diff --check`, Prisma validate, production build, service restart, and smoke checks.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify `/m/carousel`.
